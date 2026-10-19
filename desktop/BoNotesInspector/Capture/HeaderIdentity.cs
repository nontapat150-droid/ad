using System.Drawing;
namespace BoNotesInspector.Capture;
public static class HeaderIdentity
{
    public static bool Same(Bitmap first,Bitmap second)
    {
        if(first.Size!=second.Size)return false;int different=0,ink=0;
        // Compare the rendered group title, not OCR text whose spelling can vary each frame.
        for(int y=42;y<Math.Min(85,first.Height);y++)for(int x=20;x<first.Width-20;x++)
        {var a=first.GetPixel(x,y);var b=second.GetPixel(x,y);if(a.R+a.G+a.B<660||b.R+b.G+b.B<660){ink++;if(Math.Abs(a.R-b.R)+Math.Abs(a.G-b.G)+Math.Abs(a.B-b.B)>60)different++;}}
        // Compare title ink, not the large white area. A character-sized change must stop collection.
        return ink>0&&different<=Math.Max(2,ink*.002);
    }
}
