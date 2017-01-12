const micro = require('micro');
const fetch = require('node-fetch');
const FormData = require('form-data');
const Mustache = require('mustache');

const FORM_TEMPLATE = `
<form action="/" method="post">
<input type="number" id="id" name="id" value="{{id}}" placeholder="e.g. 1234" />
<button type="submit">Track!</button>
</form>
`;

const STYLES_TEMPLATE  = `
<style type="text/css">
html {
  height: 100%;
}

body {
  min-height: 100%;
  color: #333;
  font-size: 1.4rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

input[type="number"], button {
  font-size: 1.4rem;
}

input {
  flex: 1 1;
  min-width: 0;
}

form {
  display: flex;
}

.content {
  max-width: 400px;
  flex-shrink: 1;
  overflow: auto;
}

.trams {
  display: flex;
  align-items: center;
}

.trams ul {
  list-style: none;
  flex: 1 1;
}

.trams svg path {
  fill: #333;
}

.trams a {
  padding-right: 40px;
  width: 65px;
  height: 65px;
}

</style>
`;

const ROOT_TEMPLATE = `
<!doctype html>
<html>
<head><title>tt</title></head>
${STYLES_TEMPLATE}
<body>
${FORM_TEMPLATE}
</body>
</html>
`;

const TRAMS_TEMPLATE = `
<!doctype html>
<html>
<head><title>route {{id}} - tt</title></head>
${STYLES_TEMPLATE}
<body>
<div class="content">
${FORM_TEMPLATE}
<div class="trams">
<ul>
{{#trams}}
<li><strong>{{route_no}}</strong> &ndash; {{time}}</li>
{{/trams}}
</ul>
<a href="/{{id}}">
<svg width="65px" height="65px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M25.4 4.3c0 0-1.3 1.3-2.2 2.2C18.5 3.1 11.9 3.5 7.7 7.7c-2.5 2.5-3.6 5.7-3.5 9h4C8.1 14.5 8.8 12.2 10.5 10.5c2.7-2.7 6.7-3 9.8-1.2-1 1-2.2 2.2-2.2 2.2-0.8 1 0.1 1.6 0.6 1.6l5.6 0c0.3 0 0.5 0 0.5 0s0.2 0 0.5 0h1.1c0.3 0 0.5-0.2 0.5-0.5V4.9C27 4.2 26.2 3.5 25.4 4.3z"/><path d="M6.6 27.7c0 0 1.3-1.3 2.2-2.2 4.7 3.4 11.3 3 15.5-1.2 2.5-2.5 3.6-5.7 3.5-9h-4c0.1 2.2-0.6 4.5-2.3 6.2-2.7 2.7-6.7 3-9.8 1.2 1-1 2.2-2.2 2.2-2.2 0.8-1-0.1-1.6-0.6-1.6l-5.6 0c-0.3 0-0.5 0-0.5 0s-0.2 0-0.5 0H5.6c-0.3 0-0.5 0.2-0.5 0.5v7.7C5 27.8 5.8 28.5 6.6 27.7z"/></svg>
</a>
</div>
</div>
</body>
</html>
`;

const readStream = (stream) => new Promise((resolve, reject) => {
  let str = '';
  stream.on('data', chunk => str += chunk);
  stream.on('end', () => resolve(str));
});

const parseForm = (body) => body.split('&').reduce((memo, datum) => {
  const [k, v] = datum.split('=', 2);
  memo[k] = v;
  return memo;
}, {});

const server = micro(async (req, res) => {
  if (req.method === 'POST') {
    const body = await readStream(req);
    const id = parseForm(body).id;
    await handlePostId(id, res);
    return;
  }
  if (req.method === 'GET') {
    const id = (/^\/(\d+)(?:\/|\?|$)/.exec(req.url) || [])[1];
    if (id) {
      await handleGetId(id, res);
      return;
    }
    await handleGetRoot(res);
    return;
  }
  res.writeHead(404);
  res.end('404 not found');
  return;
});

const handleGetRoot = async (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html',
  });
  res.end(Mustache.render(ROOT_TEMPLATE, {}));
};

const handlePostId = async (id, res) => {
  res.writeHead(302, {
    Location: `/${id || ''}`,
  });
  res.end();
};

const handleGetId = async (id, res) => {
  const response = await fetch('http://yarratrams.com.au/base/tramTrackerController/TramInfoAjaxRequest', {
    method: 'POST',
    body: `StopID=${id}&Route=&LowFloorOnly=false`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  const data = await response.json();

  const trams = data.TramTrackerResponse.ArrivalsPages
          .reduce((a, b) => a.concat(b), [])
          .map(({ Arrival, RouteNo }) => {
            const ret = {
              time: Arrival === 'NOW' ? 'NOW' : `${Arrival}m`,
              route_no: RouteNo,
            };
            return ret;
          });

  res.writeHead(200, {
    'Content-Type': 'text/html',
  });
  res.end(Mustache.render(TRAMS_TEMPLATE, { id, trams }));
};

server.listen(3000);
