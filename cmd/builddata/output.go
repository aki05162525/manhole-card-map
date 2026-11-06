package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Resolve existing ancestors as well as symlinks, even for a new output directory.
func outputPath(path string) (string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(absolute)
	if err == nil {
		return resolved, nil
	}
	if !os.IsNotExist(err) {
		return "", err
	}
	parent, err := outputPath(filepath.Dir(absolute))
	if err != nil {
		return "", err
	}
	return filepath.Join(parent, filepath.Base(absolute)), nil
}
func within(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
func validateOutputDirectories(public, internal string) error {
	pub, err := outputPath(public)
	if err != nil {
		return err
	}
	private, err := outputPath(internal)
	if err != nil {
		return err
	}
	web, err := outputPath("web")
	if err != nil {
		return err
	}
	if within(web, private) || within(pub, private) || within(private, pub) {
		return fmt.Errorf("internal output must be outside web and separate from public output")
	}
	return nil
}
