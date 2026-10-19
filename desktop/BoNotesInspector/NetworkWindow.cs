using System.Text.Json;
using System.Windows;
using BoNotesInspector.Core;
namespace BoNotesInspector;
public partial class MainWindow
{
    private NotesApiClient? api;
    private async void ConnectServer(object sender,RoutedEventArgs e)
    {
        if(reading||busy)return;busy=true;ConnectButton.IsEnabled=false;NotesApiClient? candidate=null;
        try{candidate=new(new Uri(ServerBox.Text.Trim()));await candidate.LoginAsync(UsernameBox.Text.Trim(),PasswordBox.Password);var users=await candidate.LoadTechniciansAsync();SaveEditor();api?.Dispose();api=candidate;candidate=null;technicians=users;loading=true;TechnicianBox.ItemsSource=technicians;BatchTechBox.ItemsSource=technicians;TechnicianBox.SelectedItem=technicians.FirstOrDefault(t=>t.Id==editing?.TechnicianId);loading=false;ConnectionText.Text=$"เชื่อม {ServerBox.Text.Trim()} แล้ว • ช่างที่ใช้งานอยู่ {users.Count} คน • นำเข้าเป็นรายการรอตรวจ";StatusText.Text="โหลดรายชื่อช่างแล้ว เลือกเจ้าของงานในแท็บตรวจรายการ";}
        catch(Exception ex){candidate?.Dispose();ShowError(ex);}finally{PasswordBox.Clear();busy=false;ConnectButton.IsEnabled=true;}
    }
    private void DisconnectServer(object sender,RoutedEventArgs e){if(busy)return;api?.Dispose();api=null;PasswordBox.Clear();ConnectionText.Text="ออกจากบัญชีแล้ว — อ่าน ตรวจ และส่งออก Excel ได้";}
    private async void ImportSelected(object sender,RoutedEventArgs e)
    {
        if(reading||busy||store==null)return;
        if(api?.Connected!=true){StatusText.Text="เชื่อมบัญชีผู้ดูแลก่อนนำเข้า";return;}
        DraftGrid.CommitEdit();SaveEditor();var ids=SelectedIds();var gate=ReviewPolicy.CanImport(batch,ids,batch.Export);if(!gate.Allowed){ShowError(new InvalidOperationException(string.Join("\n",gate.Errors)));return;}
        try{store.ValidateEvidence(batch);}catch(Exception ex){ShowError(ex);return;}
        var snapshot=JsonSerializer.Deserialize<DraftBatch>(JsonSerializer.Serialize(batch))!;var selected=snapshot.Items.Where(i=>ids.Contains(i.Id)).ToArray();
        var summary=$"กลุ่ม: {snapshot.Group}\nนำเข้า {selected.Length} รายการเป็นรายการรอตรวจ (ไม่ตัดสินค้า)\n\n"+string.Join("\n",selected.Take(30).Select((i,n)=>{var p=NoteParser.Parse(i.Text);return $"{n+1}. {p.JobDate} | {NoteParser.TypeNames.GetValueOrDefault(p.Type)} | {p.CaseNo} {p.OrderNo} {p.Srt}\n   ช่าง: {i.TechnicianName} (#{i.TechnicianId}) | SN {p.Sns.Count}";}))+(selected.Length>30?"\nรายการที่เหลือดูได้ในสรุปและ Excel":"")+"\n\nยืนยันนำเข้าชุดนี้หรือไม่?";
        if(System.Windows.MessageBox.Show(this,summary,"ยืนยันข้อมูลที่ส่งออก Excel แล้ว",MessageBoxButton.YesNo,MessageBoxImage.Question)!=MessageBoxResult.Yes)return;
        busy=true;MainTabs.IsEnabled=false;ImportHistoryBox.Clear();var saved=0;
        try
        {
            await store.SaveAsync(batch);
            // Validate every selected job with the server before any write.
            foreach(var item in selected)await api.PreviewAsync(item.Text);
            foreach(var item in selected)
            {
                var local=batch.Items.Single(i=>i.Id==item.Id);
                try{var receipt=await api.UploadAsync(snapshot,item);local.ServerRecordIds=receipt.Records.Select(r=>r.Id).ToList();local.ImportStatus=string.Join(", ",receipt.Records.Select(r=>$"#{r.Id} {r.Status}"))+(receipt.Duplicate?" (ใบรับเดิม)":"");saved++;}
                catch(Exception ex){local.ImportStatus="ยังยืนยันผลไม่ได้: "+ex.Message+" — ลองนำเข้ารุ่นเดิมซ้ำได้";await store.SaveAsync(batch);ImportHistoryBox.AppendText($"{item.Id}: {local.ImportStatus}\n");throw;}
                await store.SaveAsync(batch);ImportHistoryBox.AppendText($"{item.Id} รุ่น {item.Revision}: {local.ImportStatus}\n");
            }
            StatusText.Text=$"ได้รับใบรับครบ {saved} รายการ — เปิด BO ad เพื่อตรวจรายการและยืนยันตามขั้นตอนของระบบ";
        }
        catch(Exception ex){StatusText.Text=$"ได้รับใบรับ {saved}/{selected.Length} รายการ • "+ex.Message;System.Windows.MessageBox.Show(this,StatusText.Text,"ผลนำเข้า",MessageBoxButton.OK,MessageBoxImage.Information);}
        finally{busy=false;MainTabs.IsEnabled=true;RefreshRows();}
    }
}
