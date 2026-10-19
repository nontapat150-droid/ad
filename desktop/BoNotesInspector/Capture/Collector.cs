using System.Text.Json;
using BoNotesInspector.Core;
namespace BoNotesInspector.Capture;
public record CaptureOptions(int MaxPages,int MaxSeconds,string EvidenceDirectory);
public record CollectionResult(string Reason,int Frames,IReadOnlyList<CapturedPost> Posts);
public sealed class Collector
{
    public async Task<CollectionResult> RunAsync(LineTarget target,CaptureOptions options,Action<CaptureFrame,IReadOnlyList<CapturedPost>> onFrame,CancellationToken cancel)
    {
        if(options.MaxPages is <1 or >500||options.MaxSeconds is <5 or >7200)throw new ArgumentException("ขอบเขตการอ่านไม่ถูกต้อง");
        Directory.CreateDirectory(options.EvidenceDirectory);using var ocr=new OcrReader();var assembler=new PostAssembler();
        var start=DateTimeOffset.Now;string? lastHash=null;int same=0,count=0;System.Drawing.Bitmap? header=null,previousBitmap=null;
        LineWindow.Activate(target);await Task.Delay(500,cancel);
        try{
        for(int page=0;page<options.MaxPages;page++)
        {
            if(cancel.IsCancellationRequested||LineWindow.EscapePressed)return new("ผู้ใช้หยุดอ่าน",count,assembler.Posts);
            if((DateTimeOffset.Now-start).TotalSeconds>options.MaxSeconds)return new("ถึงเวลาที่กำหนด",count,assembler.Posts);
            CaptureFrame frame;
            for(int expansion=0;;expansion++)
            {
                cancel.ThrowIfCancellationRequested();if(LineWindow.EscapePressed)return new("ผู้ใช้หยุดอ่าน",count,assembler.Posts);
                using var bitmap=LineWindow.Capture(target);var id=Guid.NewGuid().ToString("N");frame=ocr.Read(bitmap,id,Path.Combine(options.EvidenceDirectory,id+".png"),page);
                var visibleTitle=string.Join(" ",frame.Lines.Where(l=>l.Y>=30&&l.Y<65).Select(l=>l.Text));
                if(header==null){if(string.IsNullOrWhiteSpace(visibleTitle))throw new InvalidOperationException("อ่านชื่อกลุ่มไม่ได้ หยุดเพื่อป้องกันอ่านผิดหน้าต่าง");header=(System.Drawing.Bitmap)bitmap.Clone();}
                else if(!HeaderIdentity.Same(header,bitmap))throw new InvalidOperationException("หยุดอ่าน: ชื่อกลุ่มหรือหน้าต่างเปลี่ยน");
                var more=frame.Lines.FirstOrDefault(l=>l.Y>=140&&PostAssembler.IsMore(l.Text)&&l.Confidence>=65&&!frame.Images.Any(b=>l.Y>=b.Top&&l.Y<b.Bottom));
                File.WriteAllText(Path.Combine(options.EvidenceDirectory,id+".json"),JsonSerializer.Serialize(frame,new JsonSerializerOptions{WriteIndented=true}));
                if(more==null||expansion>=3)break;
                LineWindow.Expand(target,Math.Min(target.Width-25,more.X+more.Width-12),more.Y+more.Height/2);await Task.Delay(350,cancel);
            }
            using(var bitmap=new System.Drawing.Bitmap(Path.Combine(options.EvidenceDirectory,frame.ImageId+".png"))){frame=frame with{PixelShiftFromPrevious=previousBitmap==null?null:VisualRegistration.FindShift(previousBitmap,bitmap)};previousBitmap?.Dispose();previousBitmap=(System.Drawing.Bitmap)bitmap.Clone();}
            File.WriteAllText(Path.Combine(options.EvidenceDirectory,frame.ImageId+".json"),JsonSerializer.Serialize(frame,new JsonSerializerOptions{WriteIndented=true}));
            if(frame.ImageHash==lastHash)same++;else same=0;lastHash=frame.ImageHash;
            assembler.Push(frame);count++;onFrame(frame,assembler.Posts);
            if(same>=2)return new("ไม่พบความคืบหน้า — ไม่ใช่การยืนยันว่าอ่านครบทุก Notes",count,assembler.Posts);
            if(page+1<options.MaxPages){LineWindow.Scroll(target);await Task.Delay(350,cancel);}
        }
        return new("ถึงจำนวนหน้าที่กำหนด",count,assembler.Posts);
        }finally{header?.Dispose();previousBitmap?.Dispose();}
    }
}
