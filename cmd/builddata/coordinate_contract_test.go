package main

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestFacilityCoordinateGeographicBoundaries(t *testing.T) {
	now, _ := time.Parse("2006-01-02", "2026-11-05")
	for _, latitude := range []float64{85, 85.01, 85.051129, 86, 90, 90.01} {
		for _, sign := range []float64{-1, 1} {
			lat := latitude * sign
			t.Run(fmt.Sprintf("latitude_%g", lat), func(t *testing.T) {
				d, l := pilotFixture(t)
				l.Places[0].Coordinate.Lat = lat
				err := applyPlaceLedger(&d, l, now)
				if latitude > 90 {
					if err == nil {
						t.Fatal("out-of-range latitude accepted")
					}
					return
				}
				if err != nil {
					t.Fatalf("valid geographical latitude rejected: %v", err)
				}
				appendPlacePins(&d)
				if len(d.Pins) != 1 || d.Pins[0].Lat != lat || *d.Places[0].Coordinate.Lat != lat {
					t.Fatalf("coordinate was dropped or clamped: %+v", d)
				}
			})
		}
	}
	for _, lon := range []float64{-180, -180.01, 180, 180.01} {
		d, l := pilotFixture(t)
		l.Places[0].Coordinate.Lng = lon
		err := applyPlaceLedger(&d, l, now)
		if (math.Abs(lon) <= 180) != (err == nil) {
			t.Fatalf("longitude %g: %v", lon, err)
		}
	}
	for _, coordinate := range []LedgerCoordinate{{Lat: math.NaN(), Lng: 139}, {Lat: math.Inf(1), Lng: 139}, {Lat: 35, Lng: math.Inf(-1)}} {
		d, l := pilotFixture(t)
		l.Places[0].Coordinate = &coordinate
		if applyPlaceLedger(&d, l, now) == nil {
			t.Fatal("nonfinite coordinate accepted")
		}
	}
}

func TestFacilityCoordinateJSONRejectsInvalidTypesAndMissingAxis(t *testing.T) {
	for _, value := range []string{`{"lat":true,"lng":139}`, `{"lat":"35","lng":139}`, `{"lat":35,"lng":"139"}`, `{"lat":null,"lng":139}`, `{"lat":35}`, `{"lng":139}`, `{"lat":NaN,"lng":139}`, `{"lat":35,"lng":Infinity}`, `{"lat":35,"lng":139,"extra":1}`} {
		var ledger PlaceLedger
		if decodeLedger([]byte(`{"schema":1,"places":[{"coordinate":`+value+`}],"relations":[]}`), &ledger) == nil {
			t.Fatalf("invalid coordinate accepted: %s", value)
		}
	}
}

func TestLidCoordinateGeographicBoundaries(t *testing.T) {
	for _, latitude := range []float64{85, 85.01, 85.051129, 86, 90, 90.01} {
		for _, sign := range []float64{-1, 1} {
			lat, lng := latitude*sign, 180.0
			got, err := lidCoordinate(Check{Lat: &lat, Lng: &lng})
			if latitude > 90 {
				if err == nil {
					t.Fatal("out-of-range lid accepted")
				}
				continue
			}
			if err != nil || got.Status != "confirmed" || *got.Lat != lat || *got.Lng != lng {
				t.Fatalf("lid latitude %g: %+v %v", lat, got, err)
			}
		}
	}
	for _, pair := range [][2]float64{{35, 180.01}, {35, -180.01}, {math.NaN(), 139}, {35, math.Inf(1)}} {
		lat, lng := pair[0], pair[1]
		if _, err := lidCoordinate(Check{Lat: &lat, Lng: &lng}); err == nil {
			t.Fatal("invalid lid accepted")
		}
	}
	lat := 35.0
	for _, c := range []Check{{}, {Lat: &lat}} {
		got, err := lidCoordinate(c)
		if err != nil || got.Status != "unconfirmed" || got.Lat != nil || got.Lng != nil {
			t.Fatal("missing lid became a location")
		}
	}
}

func TestCandidateCannotKeepInvalidGeographicCoordinate(t *testing.T) {
	lat, lng := 91.0, 139.0
	c := Check{Lat: &lat, Lng: &lng, CoordinateLevel: "parcel"}
	c.Source = &struct {
		Place    int  `json:"place"`
		Borrowed bool `json:"borrowed"`
	}{}
	c.ByName.Status = "一致"
	if got := placeCoordinate(c); got.Status != "unconfirmed" || got.Lat != nil {
		t.Fatal("invalid candidate coordinate retained", got)
	}
}
