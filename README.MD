<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a name="readme-top"></a>


[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/A3KSA/s7-knx">
    <img src="https://automation3000.ch/img/LOGO_A3K_site.png" alt="Logo" width="80">
  </a>

<h3 align="center">S7-KNX</h3>

  <p align="center">
    Gateway for communicating between Siemens S7 PLCs and KNX
    <br />
    ·
    <a href="https://github.com/A3KSA/s7-knx/issues">Report Bug</a>
    ·
    <a href="https://github.com/A3KSA/s7-knx/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

This project was made to allow interactions between Siemens S7 PLCs and the KNX bus.


<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Built With

* [![NodeJS][NodeJS.org]][NodeJS-url]


<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started


### Prerequisites

You need NodeJS and NPM to run this project. Tested with node v18.19.0 and v20.11.0 (current LTS)

See [NodeJS-inst-url]

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/A3KSA/s7-knx.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Set up your `.env`
   ```text
    KNX_IP=192.168.1.100
    KNX_PORT=3671
    KNX_ADDRESS=15.15.15
    KNX_MIN_DELAY=10
    KNX_MANUAL_CONNECT=false
    DEBUG='s7-knx:*'
    SEND_AT_START=false
    S7_READ_INTERVAL=100
    S7_IP=10.10.6.159
    S7_DB=10
    S7_START_OFFSET=2
   ```
5. Set up your S7 project with the given UDT and DB
6. Start
   ```sh
   npm start
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
# Usage

The configuration is made through the env variable. Since this project require dotenv, you can create a .env file with the above variable and it will be imported automatically.

The SEND_AT_START (send actual S7 value directly to the bus at launch) is not currently supported but will be in the future.

For the gateway to work, you need to use the given user data type in the resources folder. You can also find an exemple DB.
The DB should always start with an Int specifiyng the DB size.

You can use the following code in your S7 project to update it dynamically :
   ```text
      AUF   "KNX"
      L DBLG
      T     "KNX".DB_SIZE
   ```

## UDT description

You need a row in the PLC's DB for each telegram. For the moment there is a generic UDT and one for the DPT232.

The UDT define the structure with the necessary data and variable for a telegramm to be sent or received.

Generic UDT

| Line       | Description                        | Exemple |
|------------|----------------------------------- |---------|
| GA         | KNX Group Address                  | 0107064 |
| Type       | KNX Datapoint type                 | 1       |
| READ_ONLY  | If true, it is not sent to KNX     | false   |
| WRITE_ONLY | If true, it is not read from KNX   | false   |
| SEND_REQ   | Request sending to KNX             | true    |
| SEND_ACK   | Acknowledge of the sending request | false   |
| val_bool   | Value from KNX if set to type 1    | true    |
| val_int    | Int value from KNX if type 5       | 10      |
| val_real   | Real value from KXN if type 9, 14  | 42.5    |

UDT for KNX DPT 232 (RGB)

| Line       | Description                        | Exemple |
|------------|----------------------------------- |---------|
| GA         | KNX Group Address                  | 0107064 |
| Type       | KNX Datapoint type                 | 1       |
| READ_ONLY  | If true, it is not sent to KNX     | false   |
| WRITE_ONLY | If true, it is not read from KNX   | false   |
| SEND_REQ   | Request sending to KNX             | true    |
| SEND_ACK   | Acknowledge of the sending request | false   |
| byte_0     | Red hex value                      | FF      |
| byte_0     | Green hex value                    | 06      |
| byte_0     | Blue hex value                     | AA      |

### Group Address (GA)
The group address in KNX is represented with slash : 01/07/064.
The max value for a GA is 15/07/255, in the db it will be represented as 1507255.
Always add the missings 0 so the gateway know how to translate the main/middle/sub value (00/00/000).

### SEND_REQ and SEND_ACK
Setting the SEND_REQ to true will tell the gateway to send the value to KNX even if the value asn't changed.
The gateway then set SEND_ACK to true to tell the PLC it was sent. It is the PLC responsability to set those two flags to false at the next cycle.

## Data type and conversion


| Datapoint 	| KNX size           	| KNX Type       	| S7 Equivalent 	| S7 Size 	| Type 	| Supported 	|
|-----------	|--------------------	|----------------	|---------------	|---------	|------	|-----------	|
| DPT1      	| 1 bit              	| Up/Down...     	| Bool          	| 1 bit   	| 1    	| Yes       	|
| DPT2      	| 1 bit              	| Control        	| Bool          	| 1 bit   	| 1    	| Yes       	|
| DPT3      	| 4 bit              	| dimming/blind  	|               	| 8 bit   	|      	| No        	|
| DPT4      	| 8 bit              	| Character      	|               	| 8 bit   	|      	| No        	|
| DPT5      	| 8 bit UInt         	| Unsigned value 	| UInt          	| 16 bit  	| 5    	| Yes*      	|
| DPT6      	| 8 bit Int          	| Signed value   	| Int           	| 16 bit  	|      	| No        	|
| DPT7      	| 16 bit UInt        	| Unsigned value 	| UInt          	| 16 bit  	|      	| No        	|
| DPT8      	| 16 bit Int         	| Signed value   	| Int           	| 16 bit  	|      	| No        	|
| DPT9      	| 16 bit float       	| Float          	| Real          	| 32 bit  	| 9    	| Yes*      	|
| DPT10     	| 24 bit time        	| Time           	| DWord         	| 32 bit  	|      	| No        	|
| DPT11     	| 24 bit date        	| Date           	| DWord         	| 32 bit  	|      	| No        	|
| DPT12     	| 32 bit UInt        	| Unsigned value 	| UDint         	| 32 bit  	|      	| No        	|
| DPT13     	| 32 bit Int         	| Signed value   	| DInt          	| 32 bit  	| 13    | Yes        	|
| DPT14     	| 32 bit float       	| Float          	| Real          	| 32 bit  	| 14   	| Yes        	|
| DPT15     	| 32 bit             	| Unsigned value 	| UDInt         	| 32 bit  	|      	| No        	|
| DPT16     	| 14 byte            	| 14 char string 	| String        	| 640 bit 	|      	| No        	|
| DPT17     	| 8 bit UInt         	| Scene number   	|               	| 8 bit   	|      	| No        	|
| DPT18     	| 8 bit UInt         	| Scene control  	|               	| 8 bit   	|      	| No        	|
| DPT19     	| 8 byte date & time 	| Date and time  	| LWord         	|         	|      	| No        	|
| DPT232    	| 3 byte            	| RGB           	| 3 byte         	|         	| 232  	| Yes       	|

* The value from the PLC should not exceed the size of the KNX DPT.

Since a complete word is used in the PLC for each variable, we will store them in a full word for simplicity. 
A feature to cap the max value in the gateway to prevent error should be added in the next version.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [ ] Add support for multiple KNX connection
- [ ] Add the SEND_AT_START feature
- [ ] Limit value that could be out of range and throw necessary message
- [ ] Add new type
- [ ] Improve logging (debug, trace, info...)



See the [open issues](https://github.com/A3KSA/s7-knx/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Zacharie Monnet - zacharie.monnet@automation3000.ch

Project Link: [https://github.com/A3KSA/s7-knx](https://github.com/A3KSA/s7-knx)

<p align="right">(<a href="#readme-top">back to top</a>)</p>







<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/A3KSA/s7-knx.svg?style=for-the-badge
[contributors-url]: https://github.com/A3KSA/s7-knx/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/A3KSA/s7-knx.svg?style=for-the-badge
[forks-url]: https://github.com/A3KSA/s7-knx/network/members
[stars-shield]: https://img.shields.io/github/stars/A3KSA/s7-knx.svg?style=for-the-badge
[stars-url]: https://github.com/A3KSA/s7-knx/stargazers
[issues-shield]: https://img.shields.io/github/issues/A3KSA/s7-knx.svg?style=for-the-badge
[issues-url]: https://github.com/A3KSA/s7-knx/issues
[license-shield]: https://img.shields.io/github/license/A3KSA/s7-knx.svg?style=for-the-badge
[license-url]: https://github.com/A3KSA/s7-knx/blob/main/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/linkedin_username
[product-screenshot]: images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vue.js]: https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Angular-url]: https://angular.io/
[Svelte.dev]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Laravel.com]: https://img.shields.io/badge/Laravel-FF2D20?style=for-the-badge&logo=laravel&logoColor=white
[Laravel-url]: https://laravel.com
[Bootstrap.com]: https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com
[JQuery.com]: https://img.shields.io/badge/jQuery-0769AD?style=for-the-badge&logo=jquery&logoColor=white
[JQuery-url]: https://jquery.com
[NodeJS.org]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
[NodeJS-url]: https://nodejs.org/en
[NodeJS-inst-url]: https://nodejs.org/en/download