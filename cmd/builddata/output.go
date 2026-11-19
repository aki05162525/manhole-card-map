package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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

// MkdirTemp appends a decimal suffix to this prefix.
const stagePrefix = ".builddata-"

var stageDirectoryName = regexp.MustCompile(`^\.builddata-[0-9]+$`)

func prepareOutputDir(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !entry.IsDir() || !stageDirectoryName.MatchString(entry.Name()) {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		// Only remove files that stage creates. Unexpected contents keep the directory nonempty.
		for _, name := range []string{"new", "previous"} {
			if err := os.Remove(filepath.Join(path, name)); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
		if err := os.Remove(path); err != nil {
			return err
		}
	}
	return nil
}

type stagedFile struct {
	path, dir string
	existing  bool
}
type outputBatch []stagedFile

func (batch *outputBatch) stage(path string, data []byte) error {
	dir, err := os.MkdirTemp(filepath.Dir(path), stagePrefix)
	if err != nil {
		return err
	}
	file := stagedFile{path: path, dir: dir}
	*batch = append(*batch, file)
	mode := os.FileMode(0644)
	info, err := os.Lstat(path)
	switch {
	case err == nil:
		if !info.Mode().IsRegular() {
			return fmt.Errorf("%s: expected a regular file", path)
		}
		mode = info.Mode().Perm()
		if err := os.Link(path, filepath.Join(dir, "previous")); err != nil {
			return err
		}
		(*batch)[len(*batch)-1].existing = true
	case !os.IsNotExist(err):
		return err
	}
	return os.WriteFile(filepath.Join(dir, "new"), data, mode)
}

func (batch *outputBatch) cleanup() {
	for _, file := range *batch {
		if file.dir != "" {
			os.RemoveAll(file.dir)
		}
	}
}

func (batch outputBatch) commit() error {
	for i, file := range batch {
		if err := os.Rename(filepath.Join(file.dir, "new"), file.path); err != nil {
			for j := i - 1; j >= 0; j-- {
				previous := batch[j]
				var restore error
				if previous.existing {
					restore = os.Rename(filepath.Join(previous.dir, "previous"), previous.path)
				} else {
					restore = os.Remove(previous.path)
				}
				if restore != nil {
					if previous.existing {
						batch[j].dir = "" // Keep the backup for manual recovery.
						restore = fmt.Errorf("restore %s failed, previous kept in %s: %w", previous.path, filepath.Join(previous.dir, "previous"), restore)
					} else {
						restore = fmt.Errorf("rollback failed to remove new output %s: %w", previous.path, restore)
					}
					err = errors.Join(err, restore)
				}
			}
			return err
		}
	}
	return nil
}
