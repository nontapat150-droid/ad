using System.Text.Json;
using System.Windows;
using BoNotesInspector.Core;
namespace BoNotesInspector;
public partial class MainWindow
{
    private async void ExportExcel(object sender,RoutedEventArgs e)=>await ExportSelection(false);
    private async void ExportEvidence(object sender,RoutedEventArgs e)=>await ExportSelection(true);
    private async Task ExportSelection(bool evidence)
    {
        if(reading||busy||store==null)return;
        DraftGrid.CommitEdit();SaveEditor();var ids=SelectedIds();if(ids.Length==0){StatusText.Text="เลือกรายการในแท็บตรวจรายการก่อนส่งออก";return;}
        var picker=new Microsoft.Win32.SaveFileDialog{Title=evidence?"ส่งออก Excel และชุดหลักฐาน":"ส่งออก Excel ก่อนนำเข้า",Filter=evidence?"ชุดหลักฐาน ZIP|*.zip":"Excel Workbook|*.xlsx",FileName="BO-Notes-"+DateTime.Now.ToString("yyyyMMdd-HHmmss",System.Globalization.CultureInfo.InvariantCulture)+(evidence?".zip":".xlsx"),AddExtension=true,OverwritePrompt=true};if(picker.ShowDialog()!=true)return;
        busy=true;ExportButton.IsEnabled=false;EvidenceZipButton.IsEnabled=false;
        try{var snapshot=JsonSerializer.Deserialize<DraftBatch>(JsonSerializer.Serialize(batch))!;var receipt=await Task.Run(()=>evidence?WorkbookWriter.ExportEvidenceZip(snapshot,ids,store.DirectoryPath,picker.FileName):WorkbookWriter.Export(snapshot,ids,picker.FileName));batch.Export=receipt;await store.SaveAsync(batch);RefreshSummary();StatusText.Text=$"ส่งออก {ids.Length} รายการแล้ว: {picker.FileName} • ยังไม่นำเข้า BO ad";}
        catch(Exception ex){ShowError(ex);}finally{busy=false;ExportButton.IsEnabled=true;EvidenceZipButton.IsEnabled=true;}
    }
}
