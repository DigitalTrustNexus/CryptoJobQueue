FROM alpine:3.7

RUN set -ex \
	&& apk add --no-cache \
		bash \
		git 
RUN apk add --update nodejs nodejs-npm

RUN mkdir /cronjob

WORKDIR /cronjob
COPY * /cronjob/
RUN npm install -g

CMD cp printerCondition.json.free printerCondition.json
ENV assetID 2
ENV restServer ec2-18-191-226-161.us-east-2.compute.amazonaws.com
ENV restPort 8080
ENV magentoServer ec2-18-224-91-77.us-east-2.compute.amazonaws.com
ENV magentoPort 80
ENV bcUSD 5873.17
ENV location DDG-96
ENV dimension1 6
ENV dimension2 6.5
ENV dimension3 3.3
ENV wsURL ws://localhost:8087

RUN npm install node-gyp -g
#RUN npm install secp256k1 -g
RUN node -v

CMD node mainCron.js
