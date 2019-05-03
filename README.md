# RocketChat Push Gateway

A push gateway for [RocketChat](https://github.com/RocketChat) to send notifications through [Gotify](https://github.com/gotify), a self-hosted push notification service. It is possible to route notifications to any service [Apprise](https://github.com/caronc/apprise) supports, but the project targets Gotify mainly as an open-source [FCM](https://rocket.chat/docs/administrator-guides/notifications/push-notifications/) alternative.

If you set this gateway up as your RocketChat push gateway, all the push notifications will be handled by it, no exception. All your users have to trust you with their notifications, and everyone should be hardcoded in the configs, so this gateway is targeted to home users or small teams rather than huge communities growing fast. This limitation is known, but for a couple of users, this should be fine.

## Table of contents <!-- omit in toc -->

- [Dependencies](#dependencies)
- [Configuration](#configuration)
  - [Getting a Gotify URL](#getting-a-gotify-url)
  - [Getting a RocketChat push token](#getting-a-rocketchat-push-token)
  - [Apprise config](#apprise-config)
- [Usage](#usage)
  - [Build & run](#build--run)
  - [Network topology](#network-topology)
- [Local development / quick test](#local-development--quick-test)
- [Disclaimer](#disclaimer)
- [Contact](#contact)

## Dependencies

- [Docker](https://www.docker.com/)
- [Docker Compose](https://github.com/docker/compose)
- [Ngrok](https://ngrok.com/) _(only for local development or quick testing)_

Installation on Manjaro Linux:

```bash
sudo pacman -S docker docker-compose
#trizen -S ngrok

sudo systemctl enable docker
sudo systemctl start docker
```

Of course, you'll also need a [RocketChat](https://github.com/RocketChat/Rocket.Chat/) and a [Gotify server](https://github.com/gotify/server) instance up and running. Explaining setting these up is way beyond the scope of this document, so please see their repos and online docs for proper instructions.

## Configuration

You can configure the gateway as you like, but you must have at least one valid Gotify URL and an associated RocketChat push token in an `apprise-config.yml` to make it work.

### Getting a Gotify URL

Create an app with your user:
- Log in to Gotify
- Go to **Apps**, and click **Create Application**
- Name it whatever you like (e.g., RocketChat), hit **Create**
- Optional: upload a cute icon to your new app
- Click on the eye icon to show your token: it looks like `rANd0m-APp-tOkEN`. Do not share it with anyone except the gateway admin (you).

Use this app token to formulate the Gotify URL according to the [Apprise docs](https://github.com/caronc/apprise/wiki/Notify_gotify).

This method is the same for any of the other users that you wish to handle. Everyone must have a unique Gotify URL (separate user -> app token) to be notified via this push notification gateway.

### Getting a RocketChat push token

We can get your unique RocketChat push token from its MongoDB. You might need to authenticate against the `admin` DB if your mongo user resides there, but the commands are like the following:

```bash
mongo -u ROCKETUSER --authenticationDatabase rocketchat -p
# enter mongo password
> use rocketchat
> # switched to db rocketchat
> db.getCollection("users").find({username:"USERNAME"}, {_id:1})
> # { "_id" : "RanD0m-UsERid" }
> db.getCollection("_raix_push_app_tokens").find({userId:"RanD0m-UsERid"}, {_id:0, token:1});
> # { "token" : { "gcm" : "vERy-l0nG-rAnd0M-PuSH-tOKen" } }
> exit
```

Note the `vERy-l0nG-rAnd0M-PuSH-tOKen` at the end. This token is your unique push identifier, and we'll use it as a subscription to a Gotify app.

You can query other users' push tokens as well by substituting their `USERNAME`. If somebody has more than one, it means they are logged in to multiple RocketChat apps. You can use any of them until they log out of that app (and so the token is removed), no need to add more than one to anyone in the config.

### Apprise config

Create a copy of the example config file provided, and add the Gotify URL(s) and the RocketChat push token(s) according to the example:

```bash
cp apprise-config-example.yml apprise-config.yml
# edit the apprise-config.yml with your preferred editor
# more help included about the configuration in the file
```

## Usage

### Build & run

Build the project, start it in the background, send some example notifications, and check the logs:

```bash
sudo docker-compose up --build -d

# should produce an error later in the logs
curl -X POST \
  http://localhost:10088/push/error/send \
  -F foo=bar

# should be forwarded successfully
curl -X POST \
  http://localhost:10088/push/success/send \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "push-gw-admin",
    "options": {
        "title": "Test message",
        "text": "Hello World!"
    }
}'

sudo docker-compose logs
```

Anytime you modify anything in the config, you need to rebuild the image and rerun the container using the first command.

### Network topology

You can put the gateway behind a reverse proxy preferably with an SSL cert from, e.g., Let's Encrypt. An example `nginx` proxy config can be found for Gotify here: [https://gotify.net/docs/nginx](https://gotify.net/docs/nginx). You can use a _subpath configuration_ to host the RocketChat push notification gateway on the same domain as your Gotify server, for example, using the `rewrite` rule on the `/push/...` part of the URL (see the above link and the `push.py` in this repo for details).

Malicious actors could only send spam notifications if they would know any of your long and random tags, otherwise, the notifications are not routed to a valid Gotify URL. However, the following setup is desirable when we don't want to expose it to the open, and it's also easier to achieve.

If you host RocketChat, Gotify and this push gateway on the same network, you can use local hostnames, DNS or IP addresses to set everything up:
- Add the gateway to RocketChat (settings page: `/admin/Push`) with the gateway's local hostname/IP + port e.g., `http://10.0.0.88:10088`
- Add the Gotify server URL(s) to the gateway's config with a local hostname/IP + port e.g., `gotify://gotify.server.local/rANd0m-APp-tOkEN`

This way the push gateway won't be accessible from the outside, and your push notification data won't leave the internal network.

The final network topology looks like:

```
                                   +------------+
                                   |            |
                      +----------->+ RocketChat |
                      |            |            |
                      |            +-----+------+
                      |                  |
         +------------+--+               v
   SSL   |               |        +------+-------+
+------->+ Reverse proxy |        |              |
         |               |        | Push gateway |
         +------------+--+        |              |
                      |           +-----------+--+
                      |                       |
                      |                       v
                      |                 +-----+----+
                      |                 |          |
                      +---------------->+  Gotify  |
                                        |          |
                                        +----------+
```

## Local development / quick test

Forward your locally running push notification gateway's port to a random `ngrok` domain:

```bash
ngrok http 10088
```

Then set up the allocated random URL as your RocketChat push notification gateway. Send test notifications to see it in action.    
**Tip**: adjust the gateway's log level to higher verbosity with `LOG_LEVEL=debug` in the `docker-compose.yml`.

## Disclaimer

**This is an experimental project. I do not take responsibility for anything regarding the use or misuse of the contents of this repository.**

Tested with Gotify as push notification destination, but in theory, it should work with any service [Apprise](https://github.com/caronc/apprise) supports.

## Contact

Immánuel Fodor    
[fodor.it](https://fodor.it/rcpushgwit) | [Linkedin](https://fodor.it/rcpushgwin)
