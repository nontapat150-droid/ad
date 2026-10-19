using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

namespace BoNotesInspector.Capture;
public record LineTarget(nint Handle,string Label,int Width,int Height,uint Dpi=96);
public static class LineWindow
{
    [StructLayout(LayoutKind.Sequential)] private struct Rect{public int Left,Top,Right,Bottom;}
    private delegate bool EnumWindowCallback(nint window,nint parameter);
    [DllImport("user32.dll")]private static extern bool EnumWindows(EnumWindowCallback cb,nint param);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(nint h);
    [DllImport("user32.dll")]private static extern bool IsIconic(nint h);
    [DllImport("user32.dll")]private static extern bool GetWindowRect(nint h,out Rect rect);
    [DllImport("user32.dll")]private static extern uint GetDpiForWindow(nint h);
    [DllImport("dwmapi.dll")]private static extern int DwmGetWindowAttribute(nint h,int attribute,out int value,int size);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]private static extern nint GetWindowLongPtr(nint h,int index);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(nint h,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetWindowText(nint h,StringBuilder value,int size);
    [DllImport("user32.dll")]private static extern nint GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(nint h);
    [DllImport("user32.dll")]private static extern bool PostMessage(nint h,uint msg,nint wp,nint lp);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern void mouse_event(uint flags,uint dx,uint dy,uint data,nuint extra);
    public static bool EscapePressed=>(GetAsyncKeyState(0x1b)&0x8000)!=0;
    public static List<LineTarget> List()
    {
        var result=new List<LineTarget>();
        EnumWindows((h,_)=>{
            if(!IsWindowVisible(h)||!GetWindowRect(h,out var r)||r.Right-r.Left<200||r.Bottom-r.Top<250)return true;
            GetWindowThreadProcessId(h,out var pid);
            try{using var p=Process.GetProcessById((int)pid);if(!string.Equals(p.ProcessName,"LINE",StringComparison.OrdinalIgnoreCase))return true;}
            catch{return true;}
            var title=new StringBuilder(300);GetWindowText(h,title,title.Capacity);
            result.Add(new(h,$"{title} · {r.Right-r.Left} × {r.Bottom-r.Top} · {h}",r.Right-r.Left,r.Bottom-r.Top,GetDpiForWindow(h)));return true;
        },0);return result;
    }
    public static void Activate(LineTarget target){if(IsIconic(target.Handle))throw new InvalidOperationException("กรุณาขยายหน้าต่าง LINE ก่อนเริ่มอ่าน");SetForegroundWindow(target.Handle);}
    private static Rect Validate(LineTarget target)
    {
        if(!IsWindowVisible(target.Handle)||IsIconic(target.Handle)||GetForegroundWindow()!=target.Handle||!GetWindowRect(target.Handle,out var r))throw new InvalidOperationException("หยุดอ่าน: หน้าต่าง LINE ไม่อยู่ด้านหน้า กรุณาเลือกและเริ่มใหม่");
        if(r.Right-r.Left!=target.Width||r.Bottom-r.Top!=target.Height||GetDpiForWindow(target.Handle)!=target.Dpi)throw new InvalidOperationException("หยุดอ่าน: ขนาดหน้าต่างหรือ DPI เปลี่ยน กรุณาเลือกหน้าต่างใหม่");
        string? blocker=null;var content=new Rectangle(r.Left,r.Top,target.Width,target.Height);
        EnumWindows((h,_)=>{if(h==target.Handle)return false;DwmGetWindowAttribute(h,14,out var cloaked,4);if(IsBlockingOverlay((long)GetWindowLongPtr(h,-20),cloaked)&&IsWindowVisible(h)&&!IsIconic(h)&&GetWindowRect(h,out var cover)&&BlocksCapture(content,new(cover.Left,cover.Top,cover.Right-cover.Left,cover.Bottom-cover.Top))){var name=new StringBuilder(200);GetWindowText(h,name,name.Capacity);blocker=$"{name} (#{h})";return false;}return true;},0);
        if(blocker!=null)throw new InvalidOperationException("หยุดอ่าน: มีหน้าต่างอื่นบัง LINE กรุณาปิดหรือย้าย: "+blocker);
        return r;
    }
    public static bool BlocksCapture(Rectangle target,Rectangle cover){target.Inflate(-10,-10);return target.IntersectsWith(cover);}
    public static bool IsBlockingOverlay(long extendedStyle,int cloaked)=>cloaked==0&&(extendedStyle&0x20)==0;
    public static Bitmap Capture(LineTarget target)
    {
        var r=Validate(target);var b=new Bitmap(target.Width,target.Height,PixelFormat.Format24bppRgb);
        try{using var g=Graphics.FromImage(b);g.CopyFromScreen(r.Left,r.Top,0,0,b.Size,CopyPixelOperation.SourceCopy);return b;}catch{b.Dispose();throw;}
    }
    public static void Scroll(LineTarget target)
    {
        var r=Validate(target);var x=r.Left+target.Width/2;var y=r.Top+(int)(target.Height*.7);
        // Native input is limited to the chosen window's Notes list; no keyboard text is sent.
        SetCursorPos(x,y);mouse_event(0x0800,0,0,unchecked((uint)-240),0);
    }
    public static void Expand(LineTarget target,int x,int y)
    {
        if(x<10||x>target.Width-20||y<140||y>target.Height-30)throw new InvalidOperationException("ตำแหน่งขยายข้อความอยู่นอกบริเวณ Notes");
        var r=Validate(target);SetCursorPos(r.Left+x,r.Top+y);mouse_event(0x0002,0,0,0,0);mouse_event(0x0004,0,0,0,0);
    }
}
