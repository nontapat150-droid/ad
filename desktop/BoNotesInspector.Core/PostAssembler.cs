using System.Text.RegularExpressions;
using System.Globalization;
namespace BoNotesInspector.Core;

public sealed class PostAssembler
{
    private readonly List<CapturedPost> posts=[];
    private readonly HashSet<string> seenFrames=[];
    private readonly Dictionary<Guid,List<(int Y,string Text,float Confidence)>> positions=[];
    private int offset;
    private string? previousFrame;
    private bool attachmentMode;
    public IReadOnlyList<CapturedPost> Posts => posts;
    private static string WithoutMarks(string text)=>new(text.Where(c=>CharUnicodeInfo.GetUnicodeCategory(c) is not (UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark)).ToArray());
    public static bool IsStart(string text)=>Regex.IsMatch(WithoutMarks(text).Replace(" ",""),@"^#(?:ปดงาน|งานMA)",RegexOptions.IgnoreCase);
    public static bool IsMore(string text)=>Regex.IsMatch(text,@"see\s*more|ดูเพิ่มเติม|อ่านเพิ่มเติม",RegexOptions.IgnoreCase);
    private static bool IsFooter(string text)=>Regex.IsMatch(text,@"^(?:\d+\s*(?:hours?|minutes?|days?|weeks?|ชั่วโมง|นาที|วัน|สัปดาห์)\s*(?:ago|ก่อน|ที่แล้ว)?|just now|เมื่อสักครู่)$",RegexOptions.IgnoreCase);
    private static string Key(string s)=>Regex.Replace(s.Trim(),@"\s+"," ");
    private static bool HasVisibleTail(CapturedPost post)=>post.Text.Split('\n').Any(l=>Regex.IsMatch(WithoutMarks(l),@"^(?:หมายเหต\s*[:：]?|ระยะสายทใชในงาน\s*MA)",RegexOptions.IgnoreCase));

    public void Push(CaptureFrame frame)
    {
        if(!seenFrames.Add(frame.ImageHash))return;
        if(frame.PixelShiftFromPrevious is int shift)offset+=shift;
        var lines=frame.Lines.Where(l=>l.Y>=130&&l.Y<frame.Height-20&&l.X<frame.Width-15)
            .Where(l=>!frame.Images.Any(b=>l.Y>=b.Top&&l.Y<b.Bottom))
            .Where(l=>!string.IsNullOrWhiteSpace(l.Text)&&!Regex.IsMatch(l.Text.Trim(),@"^(?:Notes|Albums|Search|ค้นหา|อัลบั้ม|โน้ต)$",RegexOptions.IgnoreCase))
            .OrderBy(l=>l.Y).ToList();
        CapturedPost? current=null; var first=true;bool insideAttachments=attachmentMode||frame.Images.Any(b=>b.Top<=160&&b.Bottom>160);
        for(int i=0;i<lines.Count;i++)
        {
            var line=lines[i]; var value=line.Text.Trim();
            if(insideAttachments)
            {
                if(IsFooter(value))
                {
                    insideAttachments=false;
                    if(current!=null){current.HasEnd=true;current.PostedText=value;Finish(current,frame,first);first=false;current=null;}
                    else {var prior=posts.LastOrDefault();if(prior!=null){prior.PostedText=value;if(HasVisibleTail(prior))prior.HasEnd=true;if(!prior.EvidenceIds.Contains(frame.ImageId))prior.EvidenceIds.Add(frame.ImageId);}}
                    continue;
                }
                // A hashtag in a white section below an attachment's dark banner is not a trusted Notes boundary.
                // Retain it as uncertain evidence text until a visible Notes footer; never mark it complete.
                if(current==null&&!IsStart(value))continue;
            }
            if(IsStart(value))
            {
                if(current!=null) { current.HasEnd=HasVisibleTail(current); Finish(current,frame,first); first=false; }
                current=new(){HasStart=true,BoundaryUncertain=insideAttachments,Author=!insideAttachments&&i>0&&!IsFooter(lines[i-1].Text)&&line.Y-lines[i-1].Y<65&&!lines[i-1].Text.Contains(':')?lines[i-1].Text.Trim():""};
            }
            if(IsFooter(value))
            {
                if(current!=null){current.HasEnd=HasVisibleTail(current)||!current.HasStart;current.PostedText=value;Finish(current,frame,first);first=false;current=null;}
                continue;
            }
            if(current==null)
            {
                // A visible author immediately before a hashtag is metadata, not a clipped job.
                if(i+1<lines.Count&&IsStart(lines[i+1].Text)&&lines[i+1].Y-line.Y<65)continue;
                if(value.Length<3)continue;
                current=new(){BoundaryUncertain=true};
            }
            current.HasSeeMore|=IsMore(value);
            if(!positions.TryGetValue(current.Id,out var sourceLines))positions[current.Id]=sourceLines=[];
            sourceLines.Add((offset+line.Y,value,line.Confidence));
            current.Text+=(current.Text.Length>0?"\n":"")+value;
            // An attached image visibly begins after the text block. Its OCR is masked above.
            if(frame.Images.Any(b=>b.Top>=line.Y+line.Height&&b.Top<(i+1<lines.Count?lines[i+1].Y:frame.Height)))
            {current.HasEnd=HasVisibleTail(current);Finish(current,frame,first);first=false;current=null;insideAttachments=true;}
        }
        if(current!=null)Finish(current,frame,first);
        attachmentMode=insideAttachments;
        previousFrame=frame.ImageId;
    }

    private void Finish(CapturedPost candidate,CaptureFrame frame,bool first)
    {
        if(string.IsNullOrWhiteSpace(candidate.Text))return;
        candidate.EvidenceIds.Add(frame.ImageId);
        var previous=posts.LastOrDefault();
        if(first&&previous is {HasStart:true,HasEnd:false}&&!candidate.HasStart&&frame.PixelShiftFromPrevious!=null&&previousFrame!=null&&previous.EvidenceIds.Contains(previousFrame)
            &&positions.TryGetValue(previous.Id,out var oldPositions)&&positions.TryGetValue(candidate.Id,out var newPositions)
            &&newPositions[0].Y<=oldPositions[^1].Y&&newPositions[^1].Y>=oldPositions[0].Y)
        {
            foreach(var incomingLine in newPositions){int match=oldPositions.FindIndex(l=>Math.Abs(l.Y-incomingLine.Y)<=3);if(match<0)oldPositions.Add(incomingLine);else if(incomingLine.Confidence>oldPositions[match].Confidence)oldPositions[match]=incomingLine;}
            oldPositions.Sort((a,b)=>a.Y.CompareTo(b.Y));previous.Text=string.Join("\n",oldPositions.Select(l=>l.Text));
            previous.HasEnd=candidate.HasEnd;previous.HasSeeMore|=candidate.HasSeeMore;previous.PostedText=candidate.PostedText;previous.EvidenceIds.Add(frame.ImageId);positions.Remove(candidate.Id);return;
        }
        if(first&&previous is {HasEnd:false})
        {
            var old=previous.Text.Split('\n');var incoming=candidate.Text.Split('\n');int overlap=0;
            for(int n=Math.Min(old.Length,incoming.Length);n>=2;n--)
                if(old.TakeLast(n).Select(Key).SequenceEqual(incoming.Take(n).Select(Key))){overlap=n;break;}
            if(overlap>=2)
            {
                previous.Text+=string.Join("",incoming.Skip(overlap).Select(s=>"\n"+s));
                previous.HasEnd=candidate.HasEnd;previous.HasSeeMore|=candidate.HasSeeMore;
                previous.PostedText=candidate.PostedText;
                previous.EvidenceIds.Add(frame.ImageId);return;
            }
        }
        posts.Add(candidate);
    }
}
