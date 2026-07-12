FROM node:22-alpine

WORKDIR /app

# zip: used at container startup (see server.js) to package roku-channel/ into a
# downloadable .zip for sideloading onto a Roku -- see the /roku-channel.zip route.
RUN apk add --no-cache zip

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000 9229

CMD ["node", "server.js"]
