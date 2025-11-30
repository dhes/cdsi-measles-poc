#!/bin/bash

input_cache_path=./input-cache
ig_ini_path=$PWD/ig.ini
tooling_jar=tooling-cli-3.8.0.jar

set -e  # Stop execution if any command fails
set -x  # Print each command before executing

echo Checking internet connection...
wget -q --spider tx.fhir.org

tooling=$input_cache_path/$tooling_jar
if test -f "$tooling"; then
  # --root-dir=. String: Root directory of the IG
	# --librarypath path to CQL libraries
	# --resourcepath path to resources (which?)
	# --include-dependencies false by default
	# --include-patients 
	# --libraryOutputPath=output/resources/library \
	# --measureOutputPath=output/resources/measure \
	# --resourcepath=input 
	# --librarypath=input/cql \
	# --root-dir=. \
	# see REFRESH-OPTIONS.md for full list

	java -jar $tooling \
		-RefreshIG \
		-ini="$ig_ini_path" \
		--include-terminology \
		--include-errors \
		--include-patients \
    --include-dependencies \
		--stamp \
		--include-errors
else
	echo "IG Refresh NOT FOUND in input-cache. Please run _updateCQFTooling. Aborting..."
fi