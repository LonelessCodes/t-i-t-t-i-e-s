include .env
export

CCARGS = -A --unstable-kv
CC = deno compile $(CCARGS)
OUTDIR = out
NAME = ee-announcements-client

all: linux

linux:
	$(CC) --target=x86_64-unknown-linux-gnu --output $(OUTDIR)/$(NAME)-x86_64-linux main.ts

run:
	deno run $(CCARGS) main.ts

clean:
	rm $(OUTDIR)/$(NAME)*
