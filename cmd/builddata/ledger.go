package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/url"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"
)

type Evidence struct {
	SourceURL          string `json:"sourceUrl"`
	SnapshotPath       string `json:"snapshotPath,omitempty"`
	SnapshotSHA256     string `json:"snapshotSHA256"`
	SourceLocator      string `json:"sourceLocator"`
	CheckedAt          string `json:"checkedAt"`
	ActorType          string `json:"actorType"`
	VerificationMethod string `json:"verificationMethod"`
}
type LedgerCoordinate struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// An omitted coordinate means unlocated. A present coordinate must supply both
// components; Go's numeric zero value must never turn missing data into a pin.
func (c *LedgerCoordinate) UnmarshalJSON(raw []byte) error {
	var value struct {
		Lat *float64 `json:"lat"`
		Lng *float64 `json:"lng"`
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(&value); err != nil {
		return err
	}
	if value.Lat == nil || value.Lng == nil {
		return fmt.Errorf("facility coordinate requires both lat and lng")
	}
	c.Lat, c.Lng = *value.Lat, *value.Lng
	return nil
}

// LocationReview is a facility's current location decision with a reason, from the ledger.
// The ledger keeps a name or address change with a new decision, so AddressStatus is always valid.
// PublicLocationReview selects only the fields used by the browser.
type LocationReview struct {
	Status        string `json:"status"`
	AddressStatus string `json:"addressStatus"`
	Reason        string `json:"reason"`
	ReviewedAt    string `json:"reviewedAt,omitempty"`
	SourceVersion string `json:"sourceVersion,omitempty"`
}

func validateLocationReview(review *LocationReview, coordinate *LedgerCoordinate) error {
	if review == nil {
		return nil
	}
	if review.Status != "confirmed" && review.Status != "withdrawn" {
		return fmt.Errorf("invalid location review status")
	}
	if review.AddressStatus != "valid" {
		return fmt.Errorf("invalid location address status")
	}
	if strings.TrimSpace(review.Reason) == "" {
		return fmt.Errorf("missing location review reason")
	}
	if (review.Status == "confirmed") != (coordinate != nil) {
		return fmt.Errorf("location review coordinate mismatch")
	}
	if review.ReviewedAt != "" {
		if _, err := time.Parse("2006-01-02", review.ReviewedAt); err != nil {
			return fmt.Errorf("invalid location review date: %w", err)
		}
	}
	return nil
}

type LedgerPlace struct {
	LocationReview *LocationReview   `json:"locationReview,omitempty"`
	ID             string            `json:"id"`
	LegacyIDs      []string          `json:"legacyIds"`
	Name           string            `json:"name"`
	Address        string            `json:"address"`
	Phone          string            `json:"phone"`
	Coordinate     *LedgerCoordinate `json:"coordinate,omitempty"`
	Evidence       Evidence          `json:"evidence"`
}

// RelationChange records an explicitly evidenced new counter, retaining old source relations.
type RelationChange struct {
	Kind             string   `json:"kind"`
	Reason           string   `json:"reason"`
	PreviousPlaceIDs []string `json:"previousPlaceIds"`
	Raw              []string `json:"raw"`
}
type LedgerRelation struct {
	MaintenanceNotes []string        `json:"maintenanceNotes,omitempty"`
	Change           *RelationChange `json:"change,omitempty"`
	ReviewUntil      string          `json:"reviewUntil,omitempty"`
	Condition        *string         `json:"condition,omitempty"`
	CardID           string          `json:"cardId"`
	PlaceID          string          `json:"placeId"`
	SourceHash       string          `json:"sourceHash"`
	Hours            []string        `json:"hours"`
	Status           string          `json:"status"`
	ValidFrom        string          `json:"validFrom,omitempty"`
	ValidTo          string          `json:"validTo,omitempty"`
	Evidence         Evidence        `json:"evidence"`
}
type PlaceLedger struct {
	Schema    int              `json:"schema"`
	Places    []LedgerPlace    `json:"places"`
	Relations []LedgerRelation `json:"relations"`
}

func decodeLedger(raw []byte, l *PlaceLedger) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(l); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return fmt.Errorf("ledger has trailing JSON")
	}
	return nil
}
func cardSourceHash(c Card) string {
	if c.ReviewSourceHash != "" {
		return c.ReviewSourceHash
	}
	return originalCardSourceHash(c)
}
func originalCardSourceHash(c Card) string {
	b, _ := json.Marshal(struct {
		PlaceText []string `json:"placeText"`
		Hours     []string `json:"hours"`
		Stock     []string `json:"stock"`
		Links     []string `json:"links"`
	}{c.PlaceText, c.Hours, c.SourceStock, c.Links})
	return hash(b)
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
	// Reviewed snapshots are removed (Issue #237); the digest still names the reviewed copy.
	if !snapshotDigest.MatchString(e.SnapshotSHA256) {
		return fmt.Errorf("invalid evidence snapshotSHA256: %q", e.SnapshotSHA256)
	}
	return nil
}

var snapshotDigest = regexp.MustCompile(`^[0-9a-f]{64}$`)

func validStatus(s string) bool {
	switch s {
	case "active", "upcoming", "suspended", "ended", "unknown":
		return true
	}
	return false
}
func relationStatus(r LedgerRelation, now time.Time) (string, error) {
	status := r.Status
	if r.ReviewUntil != "" {
		if _, err := time.Parse("2006-01-02", r.ReviewUntil); err != nil {
			return "", fmt.Errorf("invalid reviewUntil: %w", err)
		}
	}
	if !validStatus(status) {
		return "", fmt.Errorf("invalid relation status: %s", status)
	}
	var from, to time.Time
	var err error
	if r.ValidFrom != "" {
		from, err = time.Parse("2006-01-02", r.ValidFrom)
		if err != nil {
			return "", err
		}
	}
	if r.ValidTo != "" {
		to, err = time.Parse("2006-01-02", r.ValidTo)
		if err != nil {
			return "", err
		}
	}
	if !from.IsZero() && !to.IsZero() && from.After(to) {
		return "", fmt.Errorf("invalid validity interval")
	}
	today, _ := time.Parse("2006-01-02", now.Format("2006-01-02"))
	if !from.IsZero() && today.Before(from) {
		return "upcoming", nil
	}
	if !to.IsZero() && today.After(to) {
		return "ended", nil
	}
	return status, nil
}

// effectiveRelation picks, from the reviewed periods of one card and facility, the one
// that applies on now: the period containing it, else the next to start, else the last
// to end. relationStatus then reports it as upcoming or ended outside its period.
// Periods must not overlap; an empty bound is open, so a row without a period overlaps
// every other row. All periods share the same change record.
func effectiveRelation(rows []LedgerRelation, now time.Time) (LedgerRelation, error) {
	sorted := append([]LedgerRelation(nil), rows...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].ValidFrom < sorted[j].ValidFrom })
	for i := 1; i < len(sorted); i++ {
		previous, current := sorted[i-1], sorted[i]
		if previous.ValidTo == "" || current.ValidFrom == "" || current.ValidFrom <= previous.ValidTo {
			return LedgerRelation{}, fmt.Errorf("overlapping relation periods")
		}
		if !reflect.DeepEqual(previous.Change, current.Change) {
			return LedgerRelation{}, fmt.Errorf("relation periods disagree on change")
		}
	}
	today := now.Format("2006-01-02")
	for _, r := range sorted {
		if r.ValidTo == "" || today <= r.ValidTo {
			return r, nil
		}
	}
	return sorted[len(sorted)-1], nil
}

// Apply only explicitly reviewed facts. A changed upstream field keeps identity,
// but invalidates the distribution relation until its evidence is reviewed again.
func applyPlaceLedger(d *Data, l PlaceLedger, now time.Time) error {
	if l.Schema != 1 {
		return fmt.Errorf("unsupported place ledger schema: %d", l.Schema)
	}
	places := map[string]Place{}
	for _, p := range d.Places {
		places[p.ID] = p
	}
	cards := map[string]Card{}
	for _, c := range d.Cards {
		cards[c.ID] = c
	}
	aliases := map[string]string{}
	canonical := map[string]LedgerPlace{}
	for _, p := range l.Places {
		if !strings.HasPrefix(p.ID, "facility:") || len(p.ID) <= len("facility:") || p.Name == "" || p.Address == "" {
			return fmt.Errorf("incomplete stable facility: %s", p.ID)
		}
		if _, ok := canonical[p.ID]; ok {
			return fmt.Errorf("duplicate facility: %s", p.ID)
		}
		if p.Coordinate != nil && !validGeographicCoordinate(p.Coordinate.Lat, p.Coordinate.Lng) {
			return fmt.Errorf("invalid facility coordinate: %s", p.ID)
		}
		if err := validateLocationReview(p.LocationReview, p.Coordinate); err != nil {
			return fmt.Errorf("facility %s: %w", p.ID, err)
		}
		if p.LocationReview != nil && p.LocationReview.ReviewedAt > now.Format("2006-01-02") {
			return fmt.Errorf("facility %s: location decision is after evaluatedAt", p.ID)
		}
		if err := validateEvidence(p.Evidence); err != nil {
			return fmt.Errorf("facility %s: %w", p.ID, err)
		}
		matched := false
		for _, id := range p.LegacyIDs {
			if _, ok := places[id]; ok {
				matched = true
			}
			if _, ok := aliases[id]; ok {
				return fmt.Errorf("duplicate legacy alias: %s", id)
			}
			aliases[id] = p.ID
		}
		if !matched && len(p.LegacyIDs) > 0 {
			return fmt.Errorf("no current source alias for facility: %s", p.ID)
		}
		canonical[p.ID] = p
	}
	relIndexes := map[string][]int{}
	for i, r := range d.Relations {
		id := r.PlaceID
		if a, ok := aliases[id]; ok {
			id = a
		}
		key := r.CardID + "\x00" + id
		relIndexes[key] = append(relIndexes[key], i)
	}
	periods := map[string][]LedgerRelation{}
	for _, r := range l.Relations {
		key := r.CardID + "\x00" + r.PlaceID
		if _, ok := cards[r.CardID]; !ok {
			return fmt.Errorf("unknown card: %s", r.CardID)
		}
		if _, ok := canonical[r.PlaceID]; !ok {
			return fmt.Errorf("unknown canonical facility: %s", r.PlaceID)
		}
		if len(relIndexes[key]) == 0 {
			if r.Change == nil || r.Change.Kind != "addition" || strings.TrimSpace(r.Change.Reason) == "" || len(r.Change.Raw) == 0 {
				return fmt.Errorf("relation missing from source; explicit evidenced addition required: %s", key)
			}
			for _, old := range r.Change.PreviousPlaceIDs {
				found := false
				for _, previous := range d.Relations {
					if previous.CardID == r.CardID && previous.PlaceID == old {
						found = true
					}
				}
				if !found {
					return fmt.Errorf("unknown previous relation: %s / %s", r.CardID, old)
				}
			}
		} else if r.Change != nil {
			return fmt.Errorf("addition already exists in source: %s", key)
		}
		_, hashErr := hex.DecodeString(r.SourceHash)
		if len(r.SourceHash) != 64 || hashErr != nil {
			return fmt.Errorf("missing sourceHash for %s", key)
		}
		if err := validateEvidence(r.Evidence); err != nil {
			return fmt.Errorf("relation %s: %w", key, err)
		}
		if _, err := relationStatus(r, now); err != nil {
			return err
		}
		periods[key] = append(periods[key], r)
	}
	reviewed := map[string]LedgerRelation{}
	statuses := map[string]string{}
	for key, rows := range periods {
		r, err := effectiveRelation(rows, now)
		if err != nil {
			return fmt.Errorf("%w: %s", err, key)
		}
		reviewed[key] = r
		statuses[key], _ = relationStatus(r, now)
	}
	// Do not remove or silently end any previous relationship. Its correction needs
	// its own evidence-backed ledger entry.
	added := map[string]bool{}
	for _, r := range l.Relations {
		key := r.CardID + "\x00" + r.PlaceID
		if r.Change != nil && !added[key] {
			added[key] = true
			change := *r.Change
			change.PreviousPlaceIDs = append([]string(nil), r.Change.PreviousPlaceIDs...)
			for i, previous := range change.PreviousPlaceIDs {
				if canonicalID, ok := aliases[previous]; ok {
					change.PreviousPlaceIDs[i] = canonicalID
				}
			}
			d.Relations = append(d.Relations, Relation{CardID: r.CardID, PlaceID: r.PlaceID, Raw: r.Change.Raw, Change: &change, Interpretation: r.Change.Reason})
		}
	}
	for _, p := range l.Places {
		if len(p.LegacyIDs) == 0 {
			used := false
			for _, r := range l.Relations {
				if r.PlaceID == p.ID && r.Change != nil {
					used = true
				}
			}
			if !used {
				return fmt.Errorf("new facility requires an evidenced addition: %s", p.ID)
			}
		}
	}
	next := []Place{}
	for _, p := range d.Places {
		if _, ok := aliases[p.ID]; !ok {
			next = append(next, p)
		}
	}
	for _, p := range l.Places {
		ev := p.Evidence
		coordinate := Coordinate{Status: "unconfirmed", Source: ev.SourceURL, Reason: "施設情報・配布状況のみ確認。施設座標は未確認", Review: ev.ActorType + " / " + ev.CheckedAt}
		if p.Coordinate != nil {
			lat, lng := p.Coordinate.Lat, p.Coordinate.Lng
			coordinate = Coordinate{Status: "confirmed", Lat: &lat, Lng: &lng, Source: ev.SourceURL, Reason: ev.VerificationMethod, Review: ev.ActorType + " / " + ev.CheckedAt}
		}
		if p.LocationReview != nil && p.LocationReview.Status != "confirmed" {
			coordinate.Reason = p.LocationReview.Reason
		}
		next = append(next, Place{ID: p.ID, Name: p.Name, Address: p.Address, Phone: p.Phone, Coordinate: coordinate, Evidence: &ev, LocationReview: p.LocationReview})
	}
	d.Places = next
	for i := range d.Relations {
		r := &d.Relations[i]
		if id, ok := aliases[r.PlaceID]; ok {
			r.PlaceID = id
		}
		r.Status = "unknown"
		r.Review = "needs-review"
		key := r.CardID + "\x00" + r.PlaceID
		v, ok := reviewed[key]
		if !ok {
			continue
		}
		ev := v.Evidence
		r.Evidence = &ev
		r.MaintenanceNotes = append([]string(nil), v.MaintenanceNotes...)
		r.ReviewUntil = v.ReviewUntil
		if v.ReviewUntil != "" && now.Format("2006-01-02") > v.ReviewUntil {
			r.Interpretation = "確認の有効期限を過ぎています。再開・配布状況を公式情報で再確認してください"
			continue
		}
		if cardSourceHash(cards[r.CardID]) != v.SourceHash {
			r.Interpretation = "原典の配布場所・時間・配布状況・リンクが変更されています。再確認が必要です"
			continue
		}
		if v.Condition != nil {
			r.Condition = *v.Condition
		}
		r.Status = statuses[key]
		r.Hours = v.Hours
		r.ValidFrom = v.ValidFrom
		r.ValidTo = v.ValidTo
		r.Review = "verified"
	}
	// Replace card-wide status only if every distribution relation was reviewed.
	// A single active counter must not be hidden because a different counter ended.
	for i := range d.Cards {
		all, count, statuses := true, 0, map[string]bool{}
		staleEvidence := false
		verifiedActive := false
		for _, r := range d.Relations {
			if r.CardID == d.Cards[i].ID {
				count++
				staleEvidence = staleEvidence || (r.Review != "verified" && r.Evidence != nil)
				verifiedActive = verifiedActive || (r.Review == "verified" && r.Status == "active")
				all = all && r.Review == "verified"
				statuses[r.Status] = true
			}
		}
		// A changed current listing invalidates the old card-wide inference even
		// when this card has never had a reviewed ledger entry.
		if (!all || count == 0) && d.Cards[i].ReviewSourceHash != "" && d.Cards[i].ReviewSourceHash != originalCardSourceHash(d.Cards[i]) {
			staleEvidence = true
		}
		if (all && count > 0) || staleEvidence {
			status := "unknown"
			for _, candidate := range []string{"active", "upcoming", "suspended", "unknown", "ended"} {
				if statuses[candidate] {
					status = candidate
					break
				}
			}
			if staleEvidence && !verifiedActive {
				status = "unknown"
			}
			d.Cards[i].Status = status
			for j := range d.Pins {
				if d.Pins[j].Kind == "lid" && len(d.Pins[j].CardIDs) == 1 && d.Pins[j].CardIDs[0] == d.Cards[i].ID {
					d.Pins[j].Status = status
				}
			}
		}
	}
	return nil
}
func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }

// Geographic validity is separate from the map projection or saved viewport.
// Do not clamp adopted coordinates to a renderer's Mercator latitude limit.
func validGeographicCoordinate(lat, lng float64) bool {
	return finite(lat) && finite(lng) && math.Abs(lat) <= 90 && math.Abs(lng) <= 180
}
func appendPlacePins(d *Data) {
	for _, p := range d.Places {
		if p.Coordinate.Status != "confirmed" {
			continue
		}
		if p.Coordinate.Lat == nil || p.Coordinate.Lng == nil || !validGeographicCoordinate(*p.Coordinate.Lat, *p.Coordinate.Lng) {
			continue
		}
		ids := map[string]bool{}
		status := ""
		for _, r := range d.Relations {
			if r.PlaceID != p.ID || r.Review != "verified" {
				continue
			}
			ids[r.CardID] = true
			s := r.Status
			if s == "" {
				s = "unknown"
			}
			if status == "" {
				status = s
			} else if status != s {
				status = "unknown"
			}
		}
		if len(ids) == 0 {
			continue
		}
		cardIDs := []string{}
		for id := range ids {
			cardIDs = append(cardIDs, id)
		}
		sort.Strings(cardIDs)
		d.Pins = append(d.Pins, Pin{ID: p.ID, Kind: "place", CardIDs: cardIDs, Status: status, Lat: *p.Coordinate.Lat, Lng: *p.Coordinate.Lng})
	}
}
func qualityReport(d Data) any {
	coords := map[string]int{}
	reviews := map[string]int{}
	pins := map[string]int{}
	for _, p := range d.Places {
		coords[p.Coordinate.Status]++
	}
	for _, r := range d.Relations {
		reviews[r.Review]++
	}
	for _, p := range d.Pins {
		pins[p.Kind]++
	}
	hashes := map[string]string{}
	missing := []string{}
	linked := map[string]bool{}
	for _, r := range d.Relations {
		linked[r.CardID] = true
	}
	for _, c := range d.Cards {
		hashes[c.ID] = cardSourceHash(c)
		if !linked[c.ID] {
			missing = append(missing, c.ID)
		}
	}
	cardDisplay, displayedPlaces, locatedVerified := displayCoverage(d)
	return map[string]any{"schema": 1, "updated": d.Updated, "cards": len(d.Cards), "places": len(d.Places), "relations": len(d.Relations), "coordinates": coords, "reviews": reviews, "pins": pins, "cardsWithoutPlaces": missing, "sourceHashes": hashes,
		"cardDisplay": cardDisplay, "displayedPlaces": displayedPlaces, "locatedVerifiedPairs": locatedVerified}
}

// displayCoverage counts each card and facility pair once, however many relation rows it has.
// A card is shown at all, some or none of its facilities by the place pins; a card without
// relations is shown at none. locatedVerified counts verified pairs whose facility has a pin
// coordinate, by distribution status: not the facilities where a card can be received today.
func displayCoverage(d Data) (map[string]int, int, map[string]int) {
	shown := map[string]bool{}
	displayedPlaces := 0
	for _, p := range d.Pins {
		if p.Kind != "place" {
			continue
		}
		displayedPlaces++
		for _, id := range p.CardIDs {
			shown[id+"\x00"+p.ID] = true
		}
	}
	located := map[string]bool{}
	for _, p := range d.Places {
		c := p.Coordinate
		located[p.ID] = c.Status == "confirmed" && c.Lat != nil && c.Lng != nil && validGeographicCoordinate(*c.Lat, *c.Lng)
	}
	seen := map[string]bool{}
	pairs, shownPairs := map[string]int{}, map[string]int{}
	locatedVerified := map[string]int{}
	for _, r := range d.Relations {
		key := r.CardID + "\x00" + r.PlaceID
		if seen[key] {
			continue
		}
		seen[key] = true
		pairs[r.CardID]++
		if shown[key] {
			shownPairs[r.CardID]++
		}
		if r.Review == "verified" && located[r.PlaceID] {
			status := r.Status
			if status == "" {
				status = "unknown"
			}
			locatedVerified[status]++
		}
	}
	cardDisplay := map[string]int{"all": 0, "partial": 0, "none": 0}
	for _, c := range d.Cards {
		switch n := shownPairs[c.ID]; {
		case n == 0:
			cardDisplay["none"]++
		case n == pairs[c.ID]:
			cardDisplay["all"]++
		default:
			cardDisplay["partial"]++
		}
	}
	return cardDisplay, displayedPlaces, locatedVerified
}
