#define ENABLE_GxEPD2_GFX 0



//#include <FS.h>
//#include <SPIFFS.h>
#include <WiFi.h>
#include <ESPping.h>
#include <HTTPClient.h>
//#include <GxEPD2_BW.h>
#include <GxEPD2_3C.h>
//#include <GxEPD2_4C.h>
//#include <GxEPD2_7C.h>


//#include <Fonts/FreeMonoBold9pt7b.h>

#include "GxEPD2_display_selection.h"
#include "GxEPD2_display_selection_added.h"

#include "GxEPD2_display_selection_new_style.h"




#if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
#if defined(__MBED__)
// SPI pins used by GoodDisplay DESPI-PICO. note: steals standard I2C pins PIN_WIRE_SDA (6), PIN_WIRE_SCL (7)
// uncomment next line for use with GoodDisplay DESPI-PICO. // MbedSPI(int miso, int mosi, int sck);
arduino::MbedSPI SPIn(4, 7, 6); // need be valid pins for same SPI channel, else fails blinking 4 long 4 short

#else // package https://github.com/earlephilhower/arduino-pico

SPIClassRP2040 SPIn(spi1, 12, 13, 10, 11); // need be valid pins for same SPI channel, else fails blinking 4 long 4 short
#endif
#endif

#if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
SPIClass hspi(HSPI);
#endif

#define CHUNK_SIZE 800  // 每次讀取的位元組數
#define BUTTON_PIN_1 34
#define BUTTON_PIN_2 35
const char* ssid = "jA56";

//const char* ssid = "AndroidAPE2FE";

//const char* password = "0937056500";
const char* password = "misakalbj832";
char* url_getBitmap = "http://10.236.124.201:8080/bitmap1";
const unsigned long timeout = 5000;  // 最多等待 3 秒
    unsigned long startTime = millis(); ;
    bool actionTaken = false;

uint8_t* bBuffer;
uint8_t* rBuffer;
int total = 0;     // 記錄總共讀取的資料大小
void setup()
{
//WiFi.begin(ssid, password);
   //initWiFi();
  Serial.begin(115200);
  
  delay(100);
  
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    Serial.println("🌞 已經從按鈕喚醒！");
    delay(1000);
    pinMode(BUTTON_PIN_1, INPUT_PULLUP); // 拉高避免誤觸
    pinMode(BUTTON_PIN_2, INPUT_PULLUP); // 拉高避免誤觸
    Serial.println("判斷start");
    

    while (millis() - startTime < timeout) {
      Serial.println("判斷......");
    if (digitalRead(BUTTON_PIN_1) == LOW) {
      Serial.println("判斷到按鈕 1");
      url_getBitmap = "http://10.236.124.201:8080/bitmap1";
      actionTaken = true;
      break;
    }
    if (digitalRead(BUTTON_PIN_2) == LOW) {
      Serial.println("判斷到按鈕 2");
      url_getBitmap = "http://192.168.100.12:8080/bitmap2";
      actionTaken = true;
      break;
    }
    delay(100); // 每 100ms 檢查一次
    }

    if (!actionTaken) {
      Serial.println("⚠️ 未偵測到按鈕，再次進入睡眠");
      esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN_1, 0);
      delay(500);
      esp_deep_sleep_start();
    }

  }

 
  

  
  delay(100); // 等待 Serial 可用

#if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
  display.epd2.selectSPI(SPIn, SPISettings(4000000, MSBFIRST, SPI_MODE0));
  pinMode(15, INPUT_PULLUP); // safety pin
  while (!digitalRead(15)) delay(100); // check safety pin for fail recovery
  pinMode(16, OUTPUT); digitalWrite(16, HIGH); // power to the paper
#endif
#if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
  hspi.begin(18, 19, 23, 5); // remap hspi for EPD (swap pins)
  display.epd2.selectSPI(hspi, SPISettings(4000000, MSBFIRST, SPI_MODE0));
#elif (defined(ARDUINO_ARCH_ESP32) && defined(ARDUINO_LOLIN_S2_MINI))
  SPI.begin(18, -1, 16, 33); // my LOLIN ESP32 S2 mini connection
#endif
  display.init(115200, true, 2, false); // USE THIS for Waveshare boards with "clever" reset circuit, 2ms reset pulse
 

  //delay(1000);

  display.fillScreen(GxEPD_WHITE);
  delay(1000);

  WiFi.begin(ssid, password);
  //int wifi_counter = 0;
  while (WiFi.status() != WL_CONNECTED) {
    
    delay(1000);
    Serial.println("連接中...");
    //Serial.println(WiFi.localIP());
    
  }
  Serial.println("已連接到 WiFi");
  Serial.println(WiFi.localIP());
  IPAddress ip (8, 8, 8, 8); // The remote ip to ping
  bool ret = Ping.ping(ip);
  
  if (ret) {
    Serial.println("Ping successful!");
  } else {
    Serial.println("Ping failed!");
  }
  // 使用 HTTPClient 下載檔案
   HTTPClient http;
  http.begin(url_getBitmap); // 替換成實際的 URL
  while(true){
  int httpCode = http.GET();  // 發送 GET 請求

  if (httpCode == 200) {  // 如果成功取得回應
    WiFiClient* stream = http.getStreamPtr();  // 取得資料流

    // 取得檔案大小
    size_t fileSize = stream->available();
    Serial.printf("檔案大小：%d bytes\n", fileSize);

    // 動態分配記憶體來儲存資料（每次讀取 800 bytes）
    bBuffer = (uint8_t*)malloc(CHUNK_SIZE);
    rBuffer = (uint8_t*)malloc(CHUNK_SIZE);
    if (bBuffer == nullptr) {
      Serial.println("記憶體分配失敗");
      return;
    }
    if (rBuffer == nullptr) {
      Serial.println("記憶體分配失敗");
      return;
    }
    int round = 0;
    // 分批讀取資料並寫入顯示器
    while (http.connected() && stream->available()) {
      // 每次讀取 800 bytes
      //break;
      size_t len = stream->readBytes((char*)bBuffer, CHUNK_SIZE);
      total += len;
      len = stream->readBytes((char*)rBuffer, CHUNK_SIZE);
      total += len;
      Serial.printf("讀取了 %d bytes\n", len);

      // 假設顯示器已經設定好，並且寫入資料到顯示器
      display.writeImagePart(
        bBuffer, rBuffer,   // 來源資料
        0, 0, 800, 8,   // 原圖來源的 x_part, y_part, w_bitmap, h_bitmap
        0, round*8, 800, 8,  // 寫入顯示位置 x, y, 寬度, 高度
        true, false, false
      );
      round++;
      delay(100); 
      // 如果資料還沒完全讀取完，繼續下一次讀取
      if (total < fileSize) {
        
        continue;
      }
    }

    Serial.printf("成功讀取 %d bytes\n", total);
    free(bBuffer);  // 釋放記憶體
    free(rBuffer);
    break;
  } else {
    Serial.printf("HTTP 錯誤碼：%d\n", httpCode);
    continue;
  }}

  http.end();  // 結束 HTTP 請求
  display.refresh();
  delay(10000);
  //display.writeScreenBuffer();

   //display.refresh(100, 100, 80, 80);
   //display.refresh();

  //drawBitmaps();
  display.powerOff(); 
  //drawGraphics();
  //display.powerOff(); 

  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN_1, 0);
  //uint64_t pins = (1ULL << BUTTON_PIN_1) | (1ULL << BUTTON_PIN_2);
  //esp_sleep_enable_ext1_wakeup(pins, ESP_EXT1_WAKEUP_ALL_LOW);

  pinMode(BUTTON_PIN_1, INPUT_PULLUP); // 拉高避免誤觸
  pinMode(BUTTON_PIN_2, INPUT_PULLUP); // 拉高避免誤觸

  Serial.println("😴 進入深度睡眠中，按下按鈕喚醒...");
  delay(1000); // 顯示訊息後睡覺
  
  esp_deep_sleep_start();
//*/



}

void loop()
{
}




