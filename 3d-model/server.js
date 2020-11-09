var express = require('express');           // For web server
var Axios = require('axios');               // A Promised base http client
var bodyParser = require('body-parser');    // Receive JSON format

var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + '/www'));

app.set('port', 3000);
var server = app.listen(app.get('port'), function () {
  console.log('Server listening on port ' + server.address().port);
});

var FORGE_CLIENT_ID = "ayktY1zOWynhZL5NvRjheNbeJzGGDP6P";
var FORGE_CLIENT_SECRET = "3IfAF3kOdgJ0YzKL";

var access_token = '';
var scopes = 'data:read data:write data:create bucket:create bucket:read';
const querystring = require('querystring');

app.get('/api/forge/oauth', function (req, res) {
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/authentication/v1/authenticate',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: scopes
    })
  })
    .then(function (response) {
      // Success
      access_token = response.data.access_token;
      console.log(response);
      res.redirect('/api/forge/datamanagement/bucket/create');
    })
    .catch(function (error) {
      // Failed
      console.log(error);
      res.send('Failed to authenticate');
    });
});

const bucketKey = FORGE_CLIENT_ID.toLowerCase() + '_tutorial_bucket'; // Prefix with your ID so the bucket key is unique across all buckets on all other accounts
const policyKey = 'transient'; // Expires in 24hr

app.get('/api/forge/datamanagement/bucket/create', function (req, res) {
  // Create an application shared bucket using access token from previous route
  // We will use this bucket for storing all files in this tutorial
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/oss/v2/buckets',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer ' + access_token
    },
    data: JSON.stringify({
      'bucketKey': bucketKey,
      'policyKey': policyKey
    })
  })
    .then(function (response) {
      // Success
      console.log(response);
      res.redirect('/api/forge/datamanagement/bucket/detail');
    })
    .catch(function (error) {
      if (error.response && error.response.status == 409) {
        console.log('Bucket already exists, skip creation.');
        res.redirect('/api/forge/datamanagement/bucket/detail');
      }
      // Failed
      console.log(error);
      res.send('Failed to create a new bucket');
    });
});


// Route /api/forge/datamanagement/bucket/detail
app.get('/api/forge/datamanagement/bucket/detail', function (req, res) {
  Axios({
    method: 'GET',
    url: 'https://developer.api.autodesk.com/oss/v2/buckets/' + encodeURIComponent(bucketKey) + '/details',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  })
    .then(function (response) {
      // Success
      console.log(response);
      res.redirect('/upload.html');
    })
    .catch(function (error) {
      // Failed
      console.log(error);
      res.send('Failed to verify the new bucket');
    });
});

var Buffer = require('buffer').Buffer;
String.prototype.toBase64 = function () {
  // Buffer is part of Node.js to enable interaction with octet streams in TCP streams, 
  // file system operations, and other contexts.
  return new Buffer(this).toString('base64');
};

var multer = require('multer');         // To handle file upload
var upload = multer({ dest: 'tmp/' }); // Save file into local /tmp folder

// Route /api/forge/datamanagement/bucket/upload
app.post('/api/forge/datamanagement/bucket/upload', upload.single('fileToUpload'), function (req, res) {
  var fs = require('fs'); // Node.js File system for reading files
  fs.readFile(req.file.path, function (err, filecontent) {
    Axios({
      method: 'PUT',
      url: 'https://developer.api.autodesk.com/oss/v2/buckets/' + encodeURIComponent(bucketKey) + '/objects/' + encodeURIComponent(req.file.originalname),
      headers: {
        Authorization: 'Bearer ' + access_token,
        'Content-Disposition': req.file.originalname,
        'Content-Length': filecontent.length
      },
      data: filecontent
    })
      .then(function (response) {
        // Success
        console.log(response);
        var urn = response.data.objectId.toBase64();
        res.redirect('/api/forge/modelderivative/' + urn);
      })
      .catch(function (error) {
        // Failed
        console.log(error);
        res.send('Failed to create a new object in the bucket');
      });
  });
});

app.get('/api/forge/modelderivative/:urn', function (req, res) {
  var urn = req.params.urn;
  var format_type = 'svf';
  var format_views = ['2d', '3d'];

  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer ' + access_token
    },
    data: JSON.stringify({
      'input': {
        'urn': urn
      },
      'output': {
        'formats': [
          {
            'type': format_type,
            'views': format_views
          }
        ]
      }
    })
  })
    .then(function (response) {
      // Success
      console.log(response);
      res.redirect('/viewer.html?urn=' + urn);
    })
    .catch(function (error) {
      // Failed
      console.log(error);
      res.send('Error at Model Derivative job.');
    });
  })

app.get('/api/forge/oauth/public', function (req, res) {
  // Limit public token to Viewer read only
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/authentication/v1/authenticate',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'viewables:read'
    })
  })
    .then(function (response) {
      // Success
      console.log(response);
      res.json({ access_token: response.data.access_token, expires_in: response.data.expires_in });
    })
    .catch(function (error) {
      // Failed
      console.log(error);
      res.status(500).json(error);
    });
});