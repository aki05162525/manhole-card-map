package main
import("encoding/json"; "fmt"; "os"; "net/url"; "strings"; "time"; "crypto/sha256")
type Evidence struct {
	SourceURL          string `json:"sourceUrl"`
	SnapshotPath       string `json:"snapshotPath"`
	SnapshotSHA256     string `json:"snapshotSHA256"`
	SourceLocator      string `json:"sourceLocator"`
	CheckedAt          string `json:"checkedAt"`
	ActorType          string `json:"actorType"`
	VerificationMethod string `json:"verificationMethod"`
}
func validateEvidence(e Evidence) error {
	u, err := url.Parse(e.SourceURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.User != nil {
		return fmt.Errorf("invalid evidence URL: %q", e.SourceURL)
	}
	if strings.TrimSpace(e.SourceLocator) == "" || strings.TrimSpace(e.VerificationMethod) == "" || (e.ActorType != "human" && e.ActorType != "ai") {
		return fmt.Errorf("missing evidence verification details")
	}
	if _, err := time.Parse("2006-01-02", e.CheckedAt); err != nil {
		return fmt.Errorf("invalid evidence checkedAt: %w", err)
	}
	b, err := os.ReadFile(e.SnapshotPath)
	if err != nil {
		return fmt.Errorf("evidence snapshot: %w", err)
	}
	if hash(b) != e.SnapshotSHA256 {
		return fmt.Errorf("evidence snapshot hash mismatch: %s", e.SnapshotPath)
	}
	return nil
}

func hash(b []byte) string {return fmt.Sprintf("%x",sha256.Sum256(b))}
func main(){
b,err:=os.ReadFile("data/national/issue7/kinki-west.json");if err!=nil{panic(err)}
var d struct {Updates []struct {FacilityID string `json:"facilityId"`; Evidence Evidence `json:"evidence"`} `json:"updates"`};if err=json.Unmarshal(b,&d);err!=nil{panic(err)}
for _,u:=range d.Updates {if err:=validateEvidence(u.Evidence);err!=nil{panic(fmt.Sprintf("%s: %v",u.FacilityID,err))}}
e:=d.Updates[0].Evidence;e.CheckedAt="2026-11-05T00:00:00Z";if validateEvidence(e)==nil{panic("datetime accepted")}
fmt.Printf("PASS: %d actual Evidence values; actual validateEvidence copied verbatim from cmd/builddata/ledger.go. RFC3339 negative control rejected.\n",len(d.Updates))
}
