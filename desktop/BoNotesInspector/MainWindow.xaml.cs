using System.Text.Json;
using System.Windows;
using System.Windows.Media.Imaging;
using BoNotesInspector.Capture;
using BoNotesInspector.Core;
namespace BoNotesInspector;
public partial class MainWindow:Window
{
    private CancellationTokenSource? readCancellation;
    public MainWindow(){InitializeComponent();RefreshWindows(null,null!);}
    private void RefreshWindows(object? sender,RoutedEventArgs e){WindowsBox.ItemsSource=LineWindow.List();WindowsBox.SelectedIndex=0;}
    private void StopRead(object sender,RoutedEventArgs e)=>readCancellation?.Cancel();
    private async void StartRead(object sender,RoutedEventArgs e)
    {
        if(WindowsBox.SelectedItem is not LineTarget target){StatusText.Text="ไม่พบหน้าต่าง LINE กรุณาเปิด LINE และ Notes ก่อน";return;}
        var folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"BO Notes Inspector","feasibility",DateTime.Now.ToString("yyyyMMdd-HHmmss"));
        readCancellation=new();StartButton.IsEnabled=false;StatusText.Text="กำลังอ่าน — กด Escape เพื่อหยุด และอย่าเปลี่ยนหน้าต่าง LINE";
        try
        {
            var collector=new Collector();
            var result=await Task.Run(()=>collector.RunAsync(target,new(24,300,folder),(frame,posts)=>{
                File.WriteAllText(Path.Combine(folder,"draft-posts.json"),JsonSerializer.Serialize(posts,new JsonSerializerOptions{WriteIndented=true}));
                Dispatcher.Invoke(()=>{ResultText.Text=string.Join("\n\n────────\n\n",posts.Select((p,i)=>$"รายการ {i+1} • {(p.Complete?"เห็นขอบเขตข้อความแล้ว — ต้องตรวจ OCR":"ข้อความบางส่วน/รอตรวจขอบเขต")}\n{p.Text}"));
                    var image=new BitmapImage();image.BeginInit();image.CacheOption=BitmapCacheOption.OnLoad;image.UriSource=new Uri(Path.Combine(folder,frame.ImageId+".png"));image.EndInit();EvidenceImage.Source=image;StatusText.Text=$"เก็บภาพ {frame.ScrollOrdinal+1} • พบ {posts.Count} รายการ • ยังไม่ยืนยัน SN";});
            },readCancellation.Token));
            StatusText.Text=$"{result.Reason} • {result.Frames} ภาพ • {result.Posts.Count} รายการ • บันทึกที่ {folder}";
        }
        catch(OperationCanceledException){StatusText.Text=$"หยุดแล้ว ฉบับร่างที่อ่านสำเร็จอยู่ที่ {folder}";}
        catch(Exception ex){StatusText.Text=$"ยังอ่านต่อไม่ได้: {ex.Message} • ฉบับร่างอยู่ที่ {folder}";}
        finally{StartButton.IsEnabled=true;readCancellation.Dispose();readCancellation=null;}
    }
}
