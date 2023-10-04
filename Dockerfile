FROM node:alpine

WORKDIR /app

RUN apk add git 

ARG GITHUB_WORKSPACE="/home/runner"
RUN git config --system --add safe.directory $GITHUB_WORKSPACE

# make SR think we are running on GH actions for local dev purposes. if can test locally, faster feedback loop!
ENV GITHUB_ACTIONS="true"

# trick SR to not thinking this is a PR
ENV GITHUB_EVENT_NAME="push" 
# trick SR to thinking we are on the target branch
# we will override this at runtime
ENV GITHUB_REF="refs/heads/main"

ENTRYPOINT ["./entrypoint.sh"]