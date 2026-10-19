using System.Drawing;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using BoNotesInspector.Core;
using Tesseract;
using ImageFormat = System.Drawing.Imaging.ImageFormat;
namespace BoNotesInspector.Capture;
public sealed class OcrReader:IDisposable
{
    private readonly TesseractEngine engine=new(Path.Combine(AppContext.BaseDirectory,"tessdata"),"tha+eng",EngineMode.LstmOnly);
    private readonly TesseractEngine english=new(Path.Combine(AppContext.BaseDirectory,"tessdata"),"eng",EngineMode.LstmOnly);
    public CaptureFrame Read(Bitmap bitmap,string imageId,string imagePath,int ordinal)
    {
        bitmap.Save(imagePath,ImageFormat.Png);
        var bytes=File.ReadAllBytes(imagePath);var hash=Convert.ToHexString(SHA256.HashData(bytes));
        using var enlarged=new Bitmap(bitmap,bitmap.Width*3,bitmap.Height*3);using var memory=new MemoryStream();enlarged.Save(memory,ImageFormat.Png);
        using var pix=Pix.LoadFromMemory(memory.ToArray());using var page=engine.Process(pix,PageSegMode.SparseText);using var it=page.GetIterator();
        var lines=new List<TextLine>();it.Begin();
        do{var text=it.GetText(PageIteratorLevel.TextLine);if(!string.IsNullOrWhiteSpace(text)&&it.TryGetBoundingBox(PageIteratorLevel.TextLine,out var box))lines.Add(new(text.Trim(),box.X1/3,box.Y1/3,box.Width/3,box.Height/3,it.GetConfidence(PageIteratorLevel.TextLine)));}while(it.Next(PageIteratorLevel.TextLine));
        lines.AddRange(FindMore(bitmap));
        return new(imageId,hash,DateTimeOffset.Now,ordinal,bitmap.Width,bitmap.Height,lines,ImageBands(bitmap));
    }
    private List<TextLine> FindMore(Bitmap bitmap)
    {
        using var contrast=new Bitmap(bitmap.Width*3,bitmap.Height*3);using(var g=Graphics.FromImage(contrast))
        {using var attrs=new ImageAttributes();attrs.SetColorMatrix(new ColorMatrix(new float[][]{[3,0,0,0,0],[0,3,0,0,0],[0,0,3,0,0],[0,0,0,1,0],[-1.8f,-1.8f,-1.8f,0,1]}));g.DrawImage(bitmap,new System.Drawing.Rectangle(0,0,contrast.Width,contrast.Height),0,0,bitmap.Width,bitmap.Height,GraphicsUnit.Pixel,attrs);}
        using var memory=new MemoryStream();contrast.Save(memory,ImageFormat.Png);using var pix=Pix.LoadFromMemory(memory.ToArray());using var page=english.Process(pix,PageSegMode.SparseText);using var it=page.GetIterator();
        var words=new List<TextLine>();it.Begin();do{var text=it.GetText(PageIteratorLevel.Word)?.Trim();if(!string.IsNullOrWhiteSpace(text)&&it.TryGetBoundingBox(PageIteratorLevel.Word,out var b))words.Add(new(text,b.X1/3,b.Y1/3,b.Width/3,b.Height/3,it.GetConfidence(PageIteratorLevel.Word)));}while(it.Next(PageIteratorLevel.Word));
        var result=new List<TextLine>();for(int i=0;i<words.Count-1;i++){var a=words[i];var b=words[i+1];if(a.Text.Equals("see",StringComparison.OrdinalIgnoreCase)&&b.Text.Trim('.').Equals("more",StringComparison.OrdinalIgnoreCase)&&Math.Abs(a.Y-b.Y)<10&&b.X-a.X-a.Width<30)result.Add(new("See more",a.X,Math.Min(a.Y,b.Y),b.X+b.Width-a.X,Math.Max(a.Height,b.Height),Math.Min(a.Confidence,b.Confidence)));}return result;
    }
    private static List<ImageBand> ImageBands(Bitmap bitmap)
    {
        var result=new List<ImageBand>();int start=-1,gap=0;
        for(int y=140;y<bitmap.Height-20;y+=3){int count=0,total=0;for(int x=12;x<bitmap.Width-15;x+=4){var c=bitmap.GetPixel(x,y);total++;if(Math.Min(c.R,Math.Min(c.G,c.B))<215)count++;}
            if(count>total*.30){if(start<0)start=y;gap=0;}else if(start>=0&&++gap>=4){int end=y-9;if(end-start>=24)result.Add(new(start,end));start=-1;gap=0;}}
        if(start>=0&&bitmap.Height-20-start>=24)result.Add(new(start,bitmap.Height-20));return result;
    }
    public void Dispose(){engine.Dispose();english.Dispose();}
}
