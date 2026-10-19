using System.Drawing;
using System.IO;
using BoNotesInspector.Core;
using BoNotesInspector.Capture;
using Xunit;
public class CaptureRegressionTests
{
    // Catches OCR variance in an unchanged group title stopping a read or accepting a different group.
    [Fact] public void GroupIdentityUsesRenderedHeaderRatherThanOcrSpelling()
    {
        using var one=new Bitmap(500,800);using var two=new Bitmap(500,800);
        using(var g=Graphics.FromImage(one)){g.Clear(Color.White);g.FillRectangle(Brushes.Black,120,48,140,12);}
        using(var g=Graphics.FromImage(two)){g.Clear(Color.White);g.FillRectangle(Brushes.Black,220,48,140,12);}
        Assert.True(HeaderIdentity.Same(one,one));Assert.False(HeaderIdentity.Same(one,two));
    }
    // Catches falsely treating a collapsed note as complete when grey See-more text is ignored by primary OCR.
    [Fact] public void GreySeeMoreIsDetectedAsExpansionControl()
    {
        using var bitmap=new Bitmap(535,878);using(var g=Graphics.FromImage(bitmap)){g.Clear(Color.White);using var font=new Font("Segoe UI",12);using var grey=new SolidBrush(Color.FromArgb(178,178,178));g.DrawString("SOA: Active+FibreHome",font,Brushes.Black,20,300);g.DrawString("See more",font,grey,285,300);}
        var dir=Path.Combine(Path.GetTempPath(),"bo-notes-test-"+Guid.NewGuid());Directory.CreateDirectory(dir);
        try{using var reader=new OcrReader();var frame=reader.Read(bitmap,"one",Path.Combine(dir,"one.png"),0);Assert.Contains(frame.Lines,l=>PostAssembler.IsMore(l.Text)&&l.X>=260);}
        finally{Directory.Delete(dir,true);}
    }
    [Fact] public void PhotoBoundaryWithoutVisibleFinalFieldRemainsIncomplete()
    {
        var a=new PostAssembler();a.Push(new("one","hash",DateTimeOffset.Now,0,430,700,[new("#งานMA",15,180,200,18),new("Non : 0001",15,215,200,18)],[new(260,450)]));
        Assert.False(Assert.Single(a.Posts).Complete);
    }
    // Catches relying on approximate OCR text to stitch a source whose physical overlap proves continuity.
    [Fact] public void PixelRegistrationMeasuresContentScrollAndRejectsUnrelatedFrames()
    {
        using var first=new Bitmap(535,878);using(var g=Graphics.FromImage(first)){g.Clear(Color.White);var random=new Random(529);for(int y=140;y<858;y++){using var pen=new Pen(Color.FromArgb(random.Next(20,220),random.Next(20,220),random.Next(20,220)));g.DrawLine(pen,20,y,500,y);}}
        using var next=new Bitmap(535,878);using(var g=Graphics.FromImage(next)){g.Clear(Color.White);g.DrawImage(first,new Rectangle(0,140,535,518),new Rectangle(0,340,535,518),GraphicsUnit.Pixel);}
        Assert.Equal(200,VisualRegistration.FindShift(first,next));
        using var unrelated=new Bitmap(535,878);using(var g=Graphics.FromImage(unrelated))g.Clear(Color.Blue);
        Assert.Null(VisualRegistration.FindShift(first,unrelated));
    }
    [Fact] public void VerifiedVisualOverlapJoinsOcrVariantsWithoutDuplicatingPhysicalLines()
    {
        var a=new PostAssembler();a.Push(new("one","hash1",DateTimeOffset.Now,0,430,700,[new("#งานMA",15,400,200,18),new("Non : 0001",15,430,200,18),new("SN ใหม่ : ABC001",15,530,200,18)],[]));
        a.Push(new("two","hash2",DateTimeOffset.Now,1,430,700,[new("SN ใหม่ : ABC001",15,230,200,18),new("ระยะสายที่ใช้ในงาน MA : 0",15,280,250,18),new("3 hours ago",15,330,200,18)],[],300));
        var p=Assert.Single(a.Posts);Assert.True(p.Complete);Assert.Equal(1,p.Text.Split("ABC001").Length-1);Assert.Contains("ระยะสาย",p.Text);
    }
}
