package main

import (
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"testing"
)

func TestReconcileKeepsPrintedIDWhenTableDisagrees(t *testing.T) {
	before := []gkp.Row{{ImageURL: "https://example.jp/13-100-A01.jpg", City: []string{"(A001)"}}}
	after := []gkp.Row{{Index: 3, ImageURL: before[0].ImageURL, City: []string{"(B001)"}}}
	r, err := reconcile(before, after, []identityCheck{{Kind: "lid", Image: "13-100-A01.jpg", Code: "13-100-A001"}}, []localCard{{ID: "13-100-A001"}})
	if err != nil || len(r.Rows) != 1 || r.Rows[0].PrintedID != "13-100-A001" || !r.Rows[0].IndexChanged || len(r.Rows[0].Issues) == 0 {
		t.Fatalf("%+v %v", r, err)
	}
	if _, err := reconcile(before, after, []identityCheck{{Kind: "lid", Image: "13-100-A01.jpg", Code: "x"}, {Kind: "lid", Image: "13-100-A01.jpg", Code: "y"}}, nil); err == nil {
		t.Fatal("duplicate accepted")
	}
}
