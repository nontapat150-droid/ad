namespace BoNotesInspector.Core;

public record TextLine(string Text, int X, int Y, int Width, int Height, float Confidence = 0);
public record CaptureFrame(string ImageId, string ImageHash, DateTimeOffset CapturedAt, int ScrollOrdinal,
    int Width, int Height, IReadOnlyList<TextLine> Lines, IReadOnlyList<ImageBand> Images, int? PixelShiftFromPrevious = null);
public record ImageBand(int Top, int Bottom);
public sealed class CapturedPost
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Text { get; set; } = "";
    public string Author { get; set; } = "";
    public string PostedText { get; set; } = "";
    public bool HasStart { get; set; }
    public bool HasEnd { get; set; }
    public bool HasSeeMore { get; set; }
    public bool BoundaryUncertain { get; set; }
    public List<string> EvidenceIds { get; set; } = [];
    public bool Complete => HasStart && HasEnd && !HasSeeMore && !BoundaryUncertain;
}
