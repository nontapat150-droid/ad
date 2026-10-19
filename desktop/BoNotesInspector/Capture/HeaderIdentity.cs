using System.Drawing;
namespace BoNotesInspector.Capture;
public static class HeaderIdentity
{
    public static bool Same(Bitmap first,Bitmap second)
    {
        if(first.Size!=second.Size)return false;int different=0,total=0;
        // Compare the rendered group title, not OCR text whose spelling can vary each frame.
        for(int y=42;y<Math.Min(85,first.Height);y+=2)for(int x=20;x<first.Width-20;x+=2)
        {total++;var a=first.GetPixel(x,y);var b=second.GetPixel(x,y);if(Math.Abs(a.R-b.R)+Math.Abs(a.G-b.G)+Math.Abs(a.B-b.B)>60)different++;}
        return total>0&&different<total*.015;
    }
}
