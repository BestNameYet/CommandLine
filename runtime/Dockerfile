FROM node:22-alpine
WORKDIR /opt/commandline
COPY runtime/execute-js.cjs /opt/commandline/execute-js.cjs
USER node
ENTRYPOINT ["node", "/opt/commandline/execute-js.cjs"]
