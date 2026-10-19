using System.Windows;
using BoNotesInspector.Capture;
using BoNotesInspector.Core;
namespace BoNotesInspector;
public partial class MainWindow
{
    private CancellationTokenSource? readCancellation;
    private void RefreshWindows(object? sender,RoutedEventArgs e){WindowsBox.ItemsSource=LineWindow.List();WindowsBox.SelectedIndex=0;}
    private void StopRead(object sender,RoutedEventArgs e)=>readCancellation?.Cancel();
    private async void StartRead(object sender,RoutedEventArgs e)
    {
        if(reading)return;if(WindowsBox.SelectedItem is not LineTarget target){StatusText.Text="ไม่พบหน้าต่าง LINE กรุณาเปิด Notes ก่อน";return;}
        if(string.IsNullOrWhiteSpace(GroupBox.Text)){StatusText.Text="กรุณายืนยันชื่อกลุ่มที่เปิด Notes อยู่";return;}
        if(!int.TryParse(MaxPagesBox.Text,out var pages)||pages is <1 or >500||!int.TryParse(MaxSecondsBox.Text,out var seconds)||seconds is <5 or >7200){StatusText.Text="จำนวนหน้าต้อง 1–500 และเวลา 5–7200 วินาที";return;}
        if(batch.Items.Count>0){StatusText.Text="ชุดนี้มีข้อมูลแล้ว กรุณาสร้างชุดใหม่เพื่ออ่านต่อจากตำแหน่งปัจจุบัน";return;}
        batch.Group=GroupBox.Text.Trim();if(System.Windows.MessageBox.Show(this,$"ยืนยันว่าหน้าต่าง LINE ที่เลือกเปิด Notes ของกลุ่ม “{batch.Group}” อยู่ใช่หรือไม่?","ยืนยันกลุ่มก่อนอ่าน",MessageBoxButton.YesNo,MessageBoxImage.Question)!=MessageBoxResult.Yes)return;
        var folder=Path.Combine(store!.DirectoryPath,"images");readCancellation=new();reading=true;StartButton.IsEnabled=false;ReviewTab.IsEnabled=false;GroupBox.IsEnabled=false;StatusText.Text="กำลังอ่าน — กด Escape เพื่อหยุด และอย่าเปลี่ยนหน้าต่าง LINE";
        try{var result=await Task.Run(()=>new Collector().RunAsync(target,new(pages,seconds,folder),(frame,posts)=>Dispatcher.Invoke(()=>
        {
            if(!batch.Evidence.Any(a=>a.Id==frame.ImageId))batch.Evidence.Add(new(){Id=frame.ImageId,FileName=frame.ImageId+".png",Sha256=frame.ImageHash});
            foreach(var p in posts){var i=batch.Items.FirstOrDefault(i=>i.Id==p.Id);if(i==null){i=new(){Id=p.Id,Selected=false,CapturedAt=frame.CapturedAt};batch.Items.Add(i);}i.OriginalOcr=p.Text;i.Text=p.Text;i.Author=p.Author;i.PostedText=p.PostedText;i.SourceComplete=p.Complete;i.EvidenceIds=p.EvidenceIds.ToList();}
            batch.FrameCount=frame.ScrollOrdinal+1;batch.CaptureReason="กำลังอ่าน";store.SaveAsync(batch).GetAwaiter().GetResult();ResultText.Text=string.Join("\n\n────────\n\n",batch.Items.Select((i,n)=>$"รายการ {n+1} • {(i.SourceComplete?"เห็นขอบเขต — ยังไม่ยืนยัน OCR":"บางส่วน / ต้องตรวจขอบเขต")}\n{i.Text}"));CaptureImage.Source=LoadImage(Path.Combine(folder,frame.ImageId+".png"));StatusText.Text=$"เก็บภาพ {batch.FrameCount} • {batch.Items.Count} รายการ/ชิ้นส่วน • บันทึกร่างแล้ว";
        }),readCancellation.Token));batch.CaptureReason=result.Reason;StatusText.Text=$"{result.Reason} • {result.Frames} ภาพ • ไปแท็บตรวจรายการ";}
        catch(OperationCanceledException){batch.CaptureReason="ผู้ใช้หยุดอ่าน";StatusText.Text="หยุดแล้ว ฉบับร่างที่อ่านสำเร็จยังอยู่";}
        catch(Exception ex){batch.CaptureReason=ex.Message;StatusText.Text="หยุดอ่าน: "+ex.Message;}
        finally{reading=false;StartButton.IsEnabled=true;ReviewTab.IsEnabled=true;readCancellation.Dispose();readCancellation=null;try{await store.SaveAsync(batch);}catch(Exception ex){ShowError(ex);}RefreshRows();}
    }
}
