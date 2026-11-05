"""Extract current Go Evidence rather than duplicating its schema manually."""
import pathlib,re,subprocess
E=pathlib.Path(__file__).parent
src=pathlib.Path('cmd/builddata/ledger.go').read_text()
struct=re.search(r'type Evidence struct \{.*?\n\}',src,re.S).group()
probe='''package main
import("bytes";"encoding/json";"fmt";"os")
'''+struct+'''
func main(){b,err:=os.ReadFile("data/national/issue7/kyushu-okinawa.json");if err!=nil{panic(err)};var x struct{Updates []struct{Evidence json.RawMessage};Corrections []struct{Evidence json.RawMessage}};if err=json.Unmarshal(b,&x);err!=nil{panic(err)};for _,u:=range append(x.Updates,x.Corrections...){d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;if err=d.Decode(&e);err!=nil{panic(err)}};fmt.Printf("Evidence strict decode: %d passed\\n",len(x.Updates)+len(x.Corrections))}
'''
p=E/'evidence-probe.go';p.write_text(probe);r=subprocess.run(['go','run',str(p)],capture_output=True,text=True,check=True);(E/'go-validation.txt').write_text(r.stdout);print(r.stdout,end='')
