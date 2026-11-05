package main
import("bytes";"crypto/sha256";"encoding/hex";"encoding/json";"fmt";"net/url";"os";"strings";"time")
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
func hash(b []byte) string {h:=sha256.Sum256(b);return hex.EncodeToString(h[:])}
func main(){b,e:=os.ReadFile("data/national/issue7/kyushu-okinawa.json");if e!=nil{panic(e)};var x struct{Updates []struct{FacilityID string `json:"facilityId"`;Evidence json.RawMessage}; Corrections []struct{FacilityID string `json:"facilityId"`;Evidence json.RawMessage}};if e=json.Unmarshal(b,&x);e!=nil{panic(e)};for _,u:=range append(x.Updates,x.Corrections...){var v Evidence;d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();if e=d.Decode(&v);e!=nil{panic(e)};err:=validateEvidence(v);fmt.Printf("%s original=%v",u.FacilityID,err);v.CheckedAt=v.CheckedAt[:10];err=validateEvidence(v);fmt.Printf("; date-only=%v\n",err);if err!=nil{panic(err)}}}
