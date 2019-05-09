# contest-crawler-bot

> 공모전 정보를 크롤링하여 알림을 보내주는 텔레그램 봇(@ContestCrawlerBot)

## Getting Started

> 실행 전에 서비스에 필요한 값을 설정해야합니다. 하단의 [실행 환경 설정](#Setup-runtime-environment) 항목을 참고하여 실행 전에 설정하세요.

```bash
npm install
npm start
```

## Setup runtime environment

환경 설정은 아래의 두 방법 중 하나만 수행하면 되며,

개발 환경이라면 첫번째 방법을, 서비스 환경이라면 두번째 방법을 권장합니다.

필요한 값들은 두 가지로,

텔레그램 토큰은 Telegram의 @BotFather를 통해 새 봇을 생성하여 표시되는 토큰을 사용하면 됩니다.

파이어베이스 Private key는 [Firebase](https://firebase.google.com/)에 새 프로젝트를 추가하고 '프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성'을 통해 생성된 json 파일에서 private_key 항목을 사용하면 됩니다.

1. config.dev.json 작성

```json
{
  "telegram_token": "사용할 텔레그램 토큰",
  "firebase_private_key": "파이어베이스 Private key"
}
```

2. OS의 환경변수에 추가

> 이용중인 클라우드 서비스가 있다면 해당 클라우드 서비스 설정 항목에 환경 변수를 추가하면 됩니다.

```bash
export TELEGRAM_TOKEN="사용할 텔레그램 토큰"
export FIREBASE_PRIVATE_KEY="파이어베이스 Private key"
```

## License

```
Copyright 2019 Namhyun, Gu

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
