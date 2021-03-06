import express from 'express';
import url from 'url';
import cors from 'cors';

import morgan from 'morgan';

import https from 'https';
import fs from 'fs';

import bodyParser from 'body-parser';

import { Channel, ChildChannel } from './connectors';

// Geting our API routes
import appsApi from './apps/apps.api';

const PORT = 5000;
const app = express();

const options = {
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/cert.pem')
};

app.use(morgan('dev'));

// Parsers for POST data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('*', cors({ origin: 'https://localhost:4000' }));

app.use('/api', appsApi);


app.get('/channels/', function(req, res) {
  console.log("Request for all channels");
  Channel.all().then(channels => {
    console.log("sending channels " + channels);
    res.writeHead(200, {'Content-Type': 'json'});
    res.end(JSON.stringify(channels));
  });
});

app.get('/channel/', function(req, res) {

  var parts = url.parse(req.url, true);
  var query = parts.query && parts.query.args && JSON.parse(parts.query.args);

  Channel.find({where: query}).then((channel) => {
      res.writeHead(200, {'Content-Type': 'json'});
      res.end(JSON.stringify(channel));
    })
});

app.get('/childchannels/', function(req, res) {

  var parts = url.parse(req.url, true);
  var query = parts.query && parts.query.args && JSON.parse(parts.query.args);

  let pr;

  if (query) {
    pr = ChildChannel.findAll({where: {channelId : query.id}})
  } else {
    pr = ChildChannel.all();
  }

  pr.then(channels => {
    res.writeHead(200, {'Content-Type': 'json'});
    res.end(JSON.stringify(channels));
  });
});

const server = https.createServer(options, app);

server.listen(PORT, () =>
    console.log(`GraphQl Server is now running on https://localhost:${PORT}`)
);
