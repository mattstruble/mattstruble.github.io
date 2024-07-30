.PHONY: install
install:
	hugo mod get
	hugo mod npm pack
	npm install

.PHONY: serve
serve: install
	hugo server

.PHONY: clean
clean:
	rm -f hugo-*.tgz
	rm -f hugo_stats.json
	rm -f .hugo_build.lock
	rm -rf node_modules
	rm -rf public
	hugo mod clean --all
