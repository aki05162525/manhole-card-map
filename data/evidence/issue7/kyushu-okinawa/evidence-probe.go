package main
import("bytes";"encoding/json";"fmt";"os")
type Evidence struct {
	SourceURL          string `json:"sourceUrl"`
	SnapshotPath       string `json:"snapshotPath"`
	SnapshotSHA256     string `json:"snapshotSHA256"`
	SourceLocator      string `json:"sourceLocator"`
	CheckedAt          string `json:"checkedAt"`
	ActorType          string `json:"actorType"`
	VerificationMethod string `json:"verificationMethod"`
}
func main(){b,err:=os.ReadFile("data/national/issue7/kyushu-okinawa.json");if err!=nil{panic(err)};var x struct{Updates []struct{Evidence json.RawMessage};Corrections []struct{Evidence json.RawMessage}};if err=json.Unmarshal(b,&x);err!=nil{panic(err)};for _,u:=range append(x.Updates,x.Corrections...){d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;if err=d.Decode(&e);err!=nil{panic(err)}};fmt.Printf("Evidence strict decode: %d passed\n",len(x.Updates)+len(x.Corrections))}
