#!/usr/bin/env bash
# リポジトリのルートから実行する。保存済みのファイルは再取得しない。
set -euo pipefail
mkdir -p data/work/tools web/public/maps
CLI_VERSION=1.31.2
ASSETS_COMMIT=028c18f713baecad011301ff7a69acc39bcc2ae7
if [[ ! -x data/work/tools/pmtiles ]]; then
  curl -L --fail "https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}/go-pmtiles_${CLI_VERSION}_Linux_x86_64.tar.gz" -o data/work/tools/pmtiles.tar.gz
  tar -xzf data/work/tools/pmtiles.tar.gz -C data/work/tools
fi
if [[ ! -f web/public/maps/japan.pmtiles ]]; then
  data/work/tools/pmtiles extract https://build.protomaps.com/20261020.pmtiles web/public/maps/japan.pmtiles.partial --bbox=122,20,154,46 --maxzoom=15 --download-threads=2
  data/work/tools/pmtiles verify web/public/maps/japan.pmtiles.partial
  mv web/public/maps/japan.pmtiles.partial web/public/maps/japan.pmtiles
fi
if [[ ! -f data/work/basemaps-assets.zip ]]; then
  curl -L --fail "https://github.com/protomaps/basemaps-assets/archive/${ASSETS_COMMIT}.zip" -o data/work/basemaps-assets.zip
fi
python3 - <<'PY'
import zipfile,pathlib
with zipfile.ZipFile('data/work/basemaps-assets.zip') as archive:
    for name in archive.namelist():
        rel=name.split('/',1)[-1]
        if name.endswith('/'): continue
        target=None
        if rel.startswith('fonts/'): target=pathlib.Path('web/public')/rel
        if rel.startswith('sprites/v4/light'): target=pathlib.Path('web/public/sprites')/pathlib.Path(rel).name
        if target:
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(archive.read(name))
PY
sha256sum web/public/maps/japan.pmtiles
