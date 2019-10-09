FROM node 
#ENV NPM_CONFIG_LOGLEVEL info

RUN mkdir /cronjob

WORKDIR /cronjob
RUN mkdir /cronjob/log
COPY * /cronjob/
RUN npm install -g

CMD cp printerCondition.json.free printerCondition.json
ENV assetID 2
ENV restServer ec2-18-191-226-161.us-east-2.compute.amazonaws.com
ENV restPort 8080
ENV magentoServer ec2-18-224-91-77.us-east-2.compute.amazonaws.com
ENV magentoPort 80
ENV bcUSD 5873.17
#ENV location CVN-77 
ENV printer 1
ENV dimension1 6
ENV dimension2 6.5
ENV dimension3 3.3
ENV wsURL ws://192.35.34.31:8087

RUN npm install node-gyp -g
#RUN npm install secp256k1 -g
RUN node -v

#CMD nohup node mainCron.js
CMD node mainCron.js > /cronjob/log/node.log
#RUN ln -sf /dev/stdout nohup.out
#RUN ln -sf /dev/stdout nohup.out 
