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
func main(){ b,_:=os.ReadFile("data/national/issue5/west-south.json");var x struct{ Updates []struct{Evidence json.RawMessage}; Corrections []struct{Evidence json.RawMessage} };if err:=json.Unmarshal(b,&x);err!=nil{panic(err)}; for i,u:=range append(x.Updates,x.Corrections...){d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;err:=d.Decode(&e);fmt.Printf("%d: %v\n",i,err);if (i<6)!=(err==nil){panic("unexpected schema result")}}}
