package main
import("crypto/sha256";"encoding/json";"fmt";"net/url";"os";"strings";"time")
type Evidence struct {
	SourceURL          string `json:"sourceUrl"`
	SnapshotPath       string `json:"snapshotPath"`
	SnapshotSHA256     string `json:"snapshotSHA256"`
	SourceLocator      string `json:"sourceLocator"`
	CheckedAt          string `json:"checkedAt"`
	ActorType          string `json:"actorType"`
	VerificationMethod string `json:"verificationMethod"`
}
func hash(b []byte) string {return fmt.Sprintf("%x",sha256.Sum256(b))}
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
func main(){b,err:=os.ReadFile("data/evidence/issue7/review-chugoku/evidence-input.json");if err!=nil{panic(err)};var entries []json.RawMessage;if err=json.Unmarshal(b,&entries);err!=nil{panic(err)};for i,b:=range entries{var e Evidence;dec:=json.NewDecoder(strings.NewReader(string(b)));dec.DisallowUnknownFields();if err=dec.Decode(&e);err!=nil{panic(err)};if err=validateEvidence(e);err!=nil{panic(err)};fmt.Printf("evidence %d: valid\n",i+1)}}
