docker run -d --name=cronjob -e location='CVN-77' -v $(pwd)/log:/cronjob/log cronjob
touch log/node.log
tail -f log/node.log
