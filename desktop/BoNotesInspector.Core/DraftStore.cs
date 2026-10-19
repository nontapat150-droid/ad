using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace BoNotesInspector.Core;
public sealed class DraftStore(string directory)
{
    public string DirectoryPath=>directory;
    private readonly SemaphoreSlim gate=new(1,1);
    private static readonly JsonSerializerOptions Json=new(){WriteIndented=true};
    public async Task SaveAsync(DraftBatch batch)
    {
        await gate.WaitAsync().ConfigureAwait(false);try
        {
            Directory.CreateDirectory(directory);ValidateEvidence(batch);batch.UpdatedAt=DateTimeOffset.Now;
            var file=Path.Combine(directory,"draft.json");var temp=file+".tmp";var bytes=JsonSerializer.SerializeToUtf8Bytes(batch,Json);
            await using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){await stream.WriteAsync(bytes).ConfigureAwait(false);stream.Flush(true);}
            if(File.Exists(file))File.Replace(temp,file,file+".bak",true);else File.Move(temp,file);
        }finally{gate.Release();}
    }
    public async Task<DraftBatch> LoadAsync()
    {
        await gate.WaitAsync().ConfigureAwait(false);try
        {
            DraftBatch? result=null;Exception? error=null;
            foreach(var file in new[]{Path.Combine(directory,"draft.json"),Path.Combine(directory,"draft.json.bak")})
            {try{result=JsonSerializer.Deserialize<DraftBatch>(await File.ReadAllTextAsync(file).ConfigureAwait(false),Json);if(result==null||result.SchemaVersion!=1)throw new InvalidDataException("รุ่นฉบับร่างไม่รองรับ");break;}catch(Exception ex)when(ex is IOException or JsonException or InvalidDataException){result=null;error=ex;}}
            if(result==null)throw new InvalidDataException("เปิดฉบับร่างไม่ได้",error);ValidateEvidence(result);return result;
        }finally{gate.Release();}
    }
    public void ValidateEvidence(DraftBatch batch)
    {
        if(batch.Evidence.Select(e=>e.Id).Distinct().Count()!=batch.Evidence.Count)throw new InvalidDataException("รหัสภาพซ้ำ");
        foreach(var item in batch.Items)foreach(var id in item.EvidenceIds)if(!batch.Evidence.Any(e=>e.Id==id))throw new InvalidDataException("หลักฐานภาพไม่ครบ: "+id);
        foreach(var evidence in batch.Evidence)
        {
            if(!Regex.IsMatch(evidence.FileName,@"^[A-Za-z0-9_-]+\.png$")||!Regex.IsMatch(evidence.Sha256,@"^[A-Fa-f0-9]{64}$"))throw new InvalidDataException("ชื่อหรือ hash ภาพไม่ถูกต้อง");
            var file=Path.Combine(directory,"images",evidence.FileName);if(!File.Exists(file))throw new InvalidDataException("ไม่พบภาพ: "+evidence.FileName);
            using var stream=File.OpenRead(file);if(!Convert.ToHexString(SHA256.HashData(stream)).Equals(evidence.Sha256,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("ภาพเปลี่ยนจากต้นฉบับ: "+evidence.FileName);
        }
    }
}
