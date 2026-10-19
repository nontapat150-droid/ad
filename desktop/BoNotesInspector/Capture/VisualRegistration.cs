using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
namespace BoNotesInspector.Capture;
public static class VisualRegistration
{
    public static int? FindShift(Bitmap previous,Bitmap current)
    {
        if(previous.Size!=current.Size)return null;
        var old=Rows(previous);var next=Rows(current);int best=-1,bestMatches=0;double bestRatio=0;
        for(int delta=0;delta<current.Height-210;delta++)
        {
            int matches=0,rich=0;
            for(int y=140;y<current.Height-25-delta;y+=2)
            {if(!old[y+delta].Rich||!next[y].Rich)continue;rich++;if(old[y+delta].Hash==next[y].Hash)matches++;}
            var ratio=rich==0?0:(double)matches/rich;
            if(matches>=12&&ratio>=.55&&matches*ratio>bestMatches*bestRatio){best=delta;bestMatches=matches;bestRatio=ratio;}
        }
        return best>=0?best:null;
    }
    private static (ulong Hash,bool Rich)[] Rows(Bitmap bitmap)
    {
        var rows=new (ulong,bool)[bitmap.Height];using var copy=bitmap.Clone(new Rectangle(0,0,bitmap.Width,bitmap.Height),PixelFormat.Format24bppRgb);
        var data=copy.LockBits(new Rectangle(0,0,copy.Width,copy.Height),ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);
        try{var bytes=new byte[Math.Abs(data.Stride)*copy.Height];Marshal.Copy(data.Scan0,bytes,0,bytes.Length);
            for(int y=140;y<copy.Height-20;y++){ulong hash=14695981039346656037;int dark=0,total=0;for(int x=20;x<copy.Width-35;x+=3){int index=y*data.Stride+x*3;total++;if(Math.Min(bytes[index],Math.Min(bytes[index+1],bytes[index+2]))<225)dark++;for(int c=0;c<3;c++)hash=unchecked((hash^(uint)(bytes[index+c]/8))*1099511628211);}rows[y]=(hash,dark>=Math.Max(3,total/50));}}
        finally{copy.UnlockBits(data);}return rows;
    }
}
