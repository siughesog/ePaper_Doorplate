#define ENABLE_GxEPD2_GFX 0

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPping.h>
#include <WebServer.h>
#include <SPI.h>
#include <GxEPD2_3C.h>
#include "GxEPD2_display_selection.h"
#include "GxEPD2_display_selection_added.h"
#include "GxEPD2_display_selection_new_style.h"

// RP2040 SPI 配置（保留）
#if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
#if defined(__MBED__)
arduino::MbedSPI SPIn(4, 7, 6);
#else
SPIClassRP2040 SPIn(spi1, 12, 13, 10, 11);
#endif
#endif

// ESP32 HSPI（如有）
#if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
SPIClass hspi(HSPI);
#endif

#define CHUNK_SIZE 800
#define BUTTON_PIN_1 34
#define BUTTON_PIN_2 35

// 默認圖像數據（RLE 壓縮格式）
// 格式說明：
// - 非零字節：直接存儲兩個十六進制字符（如 "FF" = 0xFF）
// - 連續0：存儲為 "(N)" 其中 N 是連續個數（如 "(100)" = 連續100個0）
// - 前30300個字符（15150字節）的壓縮數據，後續161700個字符（80850字節）全部是0
const char defaultImageCompressed[] PROGMEM = "(606)40(4)080080(5)200004(5)8040400008(5)20004002(59)080003F180106080060060180080C0000001F0200304(4)3FC0424C000DC0FFFC1F322300C00203(858)18FFE21180186180060033FFE080C0(3)03FF060600FFFE1FF8004448000C6003001B26619FFF0203(58)12C06211FC08610006001818009FFE(4)2007FFF0C3060030004DFA000C6003001164C0C0C0027FF983060C(4)0FF000C0(46)66D16213080C6301FFF80818018218000003FBFE0C0400C3060030004D7A3FFFF1FFFF1144C040C006086183060C(4)0FF000C0(46)64D3621798046200060001FFC7E210(4)200C0400C306003003F64C000C0103031166600FFE1F88418706(5)0C(49)3CD263FCB000600006000118C08210(4)201CFFF0C306003000C26C000C017B7B1F322008C60208418784(5)0C(49)1AFFE0C0F03FFFC006000118C08330000001FFFF3CC630FFFE1FFFE0C4EB1FCC6103021B133008C6020CC1858C0C(4)0C0000C0(46)12C46040603000C0060001FFC09FFE(5)2C8430C306003000EFFF1844407B7C1106000FFE027FF8858C0C(4)0C0000C0(46)33C46240F03000C7FFFE7918C08180(3)01FE2C8430C306003000E0E81844C00000110603C8C6020600CC8C0C(4)0FE000C0(846)7FFFE2439833FCC00F001918C1E1(3)01F9060CC6308306003001D0261844C00000117FF0C8C6078400CCCC0C(4)0FE000C0(46)09D8627F0E330CC00F0019FFC7DFFE(3)01060CFFF0C3063FFFF1DFFF184780FFFC1F6030CFFE1F7FF8C8C80C(4)0C0000C0(46)2AD0624FFE330CC01F801818078618000001F9FE0C0400FFFE00300146201FC700C30C1369B0C0C01E1860C8D80C0001F0000C0000C0(46)2AD062430C330CC036C01BFFE0861000000119020CC40083060030024626000700FFFC116730DFFF02184058580C(4)0C0000C0(46)69D062420C330CC06660181800863000000119020C6C008306003002473C000610C30C116730C0C00218C078580C(4)0C0000C0(46)49DF625A0C33FCC1C6381818008FE000000119FE0C38018306003000459801EF10C30C116DB0C0C0023F8070780C(4)0C0000C0(46)48C062FA0C3300C3861C3C180080E000000119020C3C01830600300044981FDF10FFFD3178B1E0C002038070700C(4)0C0000C0(46)08C067830C3000C6060667800083B8000001F9060C778303060030004C393839B0C3013160333C00020EE030300C(4)0C0000C0(846)08C1C003FC300780060041FFE79E0C000001011E0DC1F3033C03E00058ED0060F003FF277FF20FFF1E7830(60)0204(3)06(11)040010(5)5087(5)202020(1521)60(99)600007FE(85)3C(9)3FFFE7F660(37)0F8000F800300001FC(3)01FE0007C001FC000F000078(3)0183060C0000FF0006(5)F8(6)600003(7)2000618660(3)70000F0000F00001C001FC0003E001FF0003C0(15)1FC001FC00300001FE(3)01FE000FE001FF001FC000FC(3)0183060C0000FF0006(4)01FC(6)600003(7)2180610660000001F0001F8001FC0001C001FC0007F001FF000EE0(15)304003040030000183(3)018000182001830010C00186(3)018706(3)C0(6)0304(6)60(9)20666107FC(3)300030C0010C0003C00180000C000002000C20(15)300003000030000181800000018000180001818000400006(3)018784(3)C0(6)06(7)60(9)022C010660(3)300000C000040006C00180000C000006000830(15)300003000030000181801000018000180001818000C00002(3)01858C0C0000C00006(4)0600001E0004F000F8000300000FE0(3)1A1983066010000030000040000C0006C00180001800000C000830(815)3800038000300001818018000180001C0001810000C00006(4)858C0C0000C00006(4)0C00003F0007F80060000300003B80(3)3270C3F7FC180000300000C0000C000CC001F8001800000C000C20(15)1E0001E0003000018080180001FC000F0001830003800006(4)CC8C0C0000FE0006(4)0C0000618007180060000300003180(3)23C2633660180000300000C000380018C001DC001BE00008000740(15)078000780030000180C0000001FC0003C001FE0007000004(4)CCCC0C0000FE0006(4)0C0000C0C006080060000300006080(3)0386273660(3)3000008000700018C0000E001C7000180007C0(15)01C0001C003000018080000001800000E001FC0001C0000C(4)C8C80C0000C00006(4)0C0000C0C0060C0060000300002080(3)1FFC0737FE(3)30000180001C0030C000060018300018000CE0(16)E0000E0030000181800000018000007001800000600018001F0000C8D80C0000C000060000F8000C0000C0C0060C0060000300003180(3)7000073006(3)3000030000060031C000060018300010001830(16)6000060030000181800000018000003001800000600030(4)58580C0000C00006(4)060000C0C0060C0060000300001F(5)60033016(3)300006000006007FE000060018300030001830(16)6000060030000181800000018000003001800000600070(4)78580C0000C00006(4)060000C0C0060C00600003000020(4)186183354E(3)30000E0000060000C000060008300030001830(15)606006060030000183001000018000303001800020E000E0(4)70780C0000C00006(4)0306006180060C00600003000020(4)1861833D2E10000030001C00020E0000C0020C000C300030001830(815)3FC003FC00300001FE00180001FE001FE00180003FC001FF(4)70700C0000C00006(4)01FC003F80060C0060000300003E(4)186183FD26180001FC003FE003FC0000C003FC0007E00030000EE0(15)1F0001F000300001FC00180001FF000F800180000F8001FF(4)30300C0000C00006(5)F8001E00060C0060000300003FC0(3)1861830904180001FE003FE000F80000C000F00003C000300007C0(68)2060(3)1FFF80003C(90)6060(3)180080(92)6060(98)31C0(98)1F(1347)080040(8)80(12)40(17)80(4)C0(51)6018004060030C(3)07C0800180039BE30FF6007F3F80806007E0(6)100000806000300000980FCFC000C0(51)33FFE04060060840(3)0FFC018000F1630907F8633180C0F007E000C00C1FFFF831FFC08060003000008C000C4000C0(51)1818004FFF0C78C0(4)8003800021730FEFF0633187F998002000C00C0FFFF02580C080601FFFE000C40008407FFF80(850)081800C10C18318000000FEFF87FFFE02573082800633180830C002000C40C001000CDA2C08060100020FFFF1FC840400180(50)01FFC3F108111B(5)8003000027730FE7F86331808606006000C60C001000C9A6C18460100020C0C0000848400080(50)0118C04108030E60(4)800608003E530905587F3F87FDFA006000C30800100079A4C7F46010002080C0001868400080(50)0118C04198060C30000007FFFC04080306D30FF7F8018004900000F000C108001C0035FFC0846003FF0080C60FF0785FFE80(50)01FFC04FFF0EFFF8(5)0C08018713(3)018004900000F000C118001E002588C0847E(3)FCC400300000C0(51)7918C040C01E0C18(3)07F81808000D9303FFC0FFFFC7F7D6009000C0180013806788C08460(3)8C4C(4)C0(51)1918C0F080120C(3)07E41839FFC018D30200400618049456019800C0100010E0FFFFC08460000001844C0FDFF008C0(51)19FFC3EFFF021FE0(3)0418780C003FD303FFC01C0C069456019800C03000107013B0C084603FFFF1847800082018C0(851)181803C30C023860000007E7F84808008213020040780707F7D6030C00C43000100055A0C0B460018C0184700FCC6018FF(51)1BFFE043080278C01800046408080800821303FFC0FF3FC08456030C00DC7000100055A0C1E460018C01847008C64018C0(51)181800431802CCC03800046408080801BFD3020040E321C0C7D6060600F0D8001000D3A0C78460010C018C6108C3C038C0(51)18180047F00207801C000467F8080801928303FFC0212107FCD60C0303C18C00100093BEC60460030C01BCF108C3803CC0(51)3C1800407002070008000464080808011A8300C60821210084461C018303060010009180C00460070C1101F108C7C026C0(51)67800041DC021DC0080007E418080C03020301860823210084463800C00E030010001180C00E600E0C33039B0FDEF063C0(51)41FFE3CF0602F878180004047809FFE33FCE1F07F83F3F0084CC7000601C010010001183803FFE3C07F3060E083838C1FFC0(55)02C01820(4)08(7)2121008480(6)10(6)20(7)800780(2450)0204(16)40400002(6)04100008(11)80000818(6)80000C(7)40(6)0880(4)4000402000080080000408(13)0204(16)40403F8603F9FC3FBFE30430000802880E1804(6)80C01818(3)0C000080C00E00000FF80400E0406007C6004030188000C600046000403060180080C00C08(13)070E03FFFC(12)03F8402486020904318601BFFE7FC80288F8100C(3)7FFFE080C01FFFE0000009FFE080C01B3FC1FF00061F8060407F0600606018C00184000C6000606033FFE080C00C18(13)7FFFE2000460C183(4)03FC0030000040C035860209042186008180081803DCC0127FC000003FFFC08FFE3466(3)1900608FFE3108C006007FDC03FC4006060020401BFFE30FFE0C600030E01818009FFE0C18060C1830(4)3FC0030000020402060460C183(4)03FC0030000043F8358603F9FC3F9FC00FF8181802CC80664040(3)018188066462(3)19086188066188C7FFFE1190030C407FE60030C01C800618000FFF87FFFE08180182183F9FE60C1830(4)3FC0030000024402060461C180(4)03(4)07FCC82687E209042190400808111FE28A80644040(3)0187F8864042(3)190867F8866008C0060011900304FE061FE3FFFC7E86007FFC1860(3)01FFC7E21021B0661C18(5)30(5)C002060461E1(5)03(4)01B0C824860209043190478FF81190C3FE803C7FC0(3)018089861FFF800000397F6089863F08C0060011100304C4061E6019805A8600D40C1060(3)0118C0821021A0461E10(5)30(4)01C002FFF4616303(4)03000030000137C83F860209043F9FC088083FB88200C018404000001FE1808180006080000079086081800C08C1FFF81118030CCC7FC46019805A8621840C306003FC8C0118C0833021E046163030(4)300003(802)7FFFE20604216303(4)0300003000077CC8040603F9FC0010408FF87EF883FEFE12404000001821808380006080000079086083800C088186187FDFE3FDCC664461198858B66187FC0060030C8C01FFC09FFE218042163030(4)30000300000100020604332303(4)03F80030000040E804060200047FD04088080468828888337FC000001821809FFE006087FFFE5908609FFE7F98C1FFF8041183014C7FC461198858A647840C0060030C8C7918C08180219843323030(4)3F800300000300020F04333303(4)03F800300003F9BA7FC6020004041FC1CFF804098288887F04(3)182181E3081FFF87FFFE193F61E3080C7FE186180411830048664461999818A64687FC7FFFE30C8C1918C1E1003F8C43333030(4)3F800300000600020904323203(4)030000300000418A041FC23FC404104360000C0D03D488090660000018218782181860(3)19236782180D188186187FD1820068664C60999818A6808300030803FC8C19FFC7DFFE218443232030(4)30000300000FFF82198432360300007C00030000300000430A04104230C4341FC41FFE7FC702CC882AF6C0000018218486181060(3)19236486182D1881FFF80E1182FC387FCC60999018860083000308030C8C18180786182186432360300007C00030000300001E018230C4161603(4)030000300007FE0E7FD04230C427C000006004060288882A3780C0001FE18086301FFFC0000019236086302D108006000E11828430060C40D9B019870087F80308030C8C1BFFE08610218241616030(4)300003000036008260741E1603(4)030000300004020000104230C4341987FFFE040602AB88693501C00018018087F031E0400000193F6087F02F108006001F318284307FE840D9A0198D008E18020803FC8C1818008630218041E16030(4)300003000066008240241C1E03(4)03000030(4)2A904230C43430C04060044F03F388496580E00018018080F001E040000019006080F02C1081FFFC34B182843806184019801909809B300608230C8C1818008FE02180C1C1E030(4)300003(802)06008200041C1C03(4)03000030000191982A50423FC42C606060600FD98201084844C0400000018081F80660C0000019006081F80D90800600642186846806304019801B188081E00C08230C0C3C180080E03F80C1C1C030(4)300003000007FF83FFFC0C0C03(4)030000300003198C6A5FC2300467000030607E30C3FF0809C4604000000100878C1C60C0000019FFE0878C3FB1800600446184FCCC7FF0C7FFFE1B30C083F01C08630C0C67800083B82000C0C0C030(4)3000030000060183000C(12)061886481042007C43FFE013C00060620308081C00C000001F079E0670678000001980679E0670FFE7FFFE04C18485866063C3FFFE1A60609E1E780FE3387841FFE79E0C200F80(14)020004(17)020030(9)08080001(3)0C(4)60(3)11(9)040080(7)08";
const int defaultImageCompressedLen = 9574; // 壓縮後長度（字符數）
const int defaultImageZeroTailLen = 149649; // 後續0的長度（十六進制字符數）
const int defaultImageTotalBytes = 192000; // 總字節數（800*480*2 = 96000黑色 + 96000紅色）

// WiFi / API
const char* default_ssid = "";
const char* default_password = "";
const char* api_base_url = "https://epaperdoorplate-production.up.railway.app";
const unsigned long api_timeout = 10000;

// AP mode
const char* ap_ssid = "ESP32-WiFi-Config";
const char* ap_password = "12345678";
WebServer server(80);
bool isAPMode = false;

// Preferences
Preferences preferences;
const char* prefs_namespace = "device_config";
const char* wifi_namespace = "wifi_config";

// WiFi credentials (loaded)
String wifi_ssid = "";
String wifi_password = "";

// globals
unsigned long deviceStartTime = 0; // 設備啟動時間（在setup中設置）
const unsigned long button_timeout = 5000;

struct DeviceConfig {
  bool success;
  bool isActivated;
  bool needUpdate;
  int refreshInterval;
  bool hasBinData;
  int binSize;
};
DeviceConfig savedConfig = {false, false, false, 300, false, 0};

struct ActivationInfo {
  String activation_code;
  String expire_at;
  bool isValid;
};
ActivationInfo activationInfo = {"", "", false};

// forward declare
void startAPMode();
void handleRoot();
void handleSave();
void handleConfig();
void setWiFiCredentials(String ssid, String password);
void loadWiFiCredentials();
void loadSavedConfig();
void saveConfig(DeviceConfig config);
String getChipId();
void callActivateAPI(String uniqueId);
void callDeviceStatusAPI(String deviceID);
void goToDeepSleep(int sleepSeconds, bool isActivated);
int base64DecodeStreaming(const String& base64Str, int expectedSize);
int base64DecodeStreamingFromResponse(const String& response, int startIdx, int endIdx, int expectedSize);
int base64DecodeStreamingFromHTTPStream(WiFiClient* stream, HTTPClient& http, int expectedSize);
void displayDefaultImage();

// --- display object ---
// NOTE: keep the display object defined in your included display_selection headers.
// The following assumes you already have 'display' defined by those headers (as in your original).
// If not, ensure the display object exists as in your short program.

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("========== ESP32 啟動 ==========");

  pinMode(BUTTON_PIN_1, INPUT_PULLUP);
  pinMode(BUTTON_PIN_2, INPUT_PULLUP);

  preferences.begin(prefs_namespace, false);
  loadWiFiCredentials();
  loadSavedConfig();

  // 記錄設備啟動時間（用於計算實際休眠時間）
  deviceStartTime = millis();
  Serial.println("⏱️ 設備啟動時間已記錄: " + String(deviceStartTime) + " ms");
  
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) Serial.println("🌞 從按鈕喚醒");
  else if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) Serial.println("⏰ 從定時器喚醒");
  else Serial.println("🔌 首次啟動或重置");

  bool wifiConnected = false;
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("📶 嘗試連接 WiFi: " + wifi_ssid);
    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      Serial.println("\n✅ WiFi 連線成功: " + WiFi.localIP().toString());
    } else {
      Serial.println("\n❌ WiFi 連線失敗");
    }
  } else {
    Serial.println("⚠️ WiFi 憑證未設置");
  }

  // display 初始化 —— 保留你原本流程（RP2040 / HSPI 支援）
  // 無論 WiFi 是否連接，都需要初始化 display（WiFi 失敗時需要顯示默認圖像）
  #if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
    display.epd2.selectSPI(SPIn, SPISettings(4000000, MSBFIRST, SPI_MODE0));
    pinMode(15, INPUT_PULLUP);
    while (!digitalRead(15)) delay(100);
    pinMode(16, OUTPUT); digitalWrite(16, HIGH);
  #endif
  #if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
    hspi.begin(18, 19, 23, 5);
    display.epd2.selectSPI(hspi, SPISettings(4000000, MSBFIRST, SPI_MODE0));
  #elif (defined(ARDUINO_ARCH_ESP32) && defined(ARDUINO_LOLIN_S2_MINI))
    SPI.begin(18, -1, 16, 33);
  #endif

  display.init(115200, true, 2, false); // waveshare style reset
  delay(1000);
  display.fillScreen(GxEPD_WHITE);
  delay(1000);

  // 檢查 WiFi 連接狀態
  if (!wifiConnected) {
    // WiFi 連接失敗，顯示默認圖像
    Serial.println("📺 WiFi 連接失敗，顯示默認圖像");
    displayDefaultImage();
    startAPMode();
    return;
  }

  String deviceID = preferences.getString("deviceID", "");
  if (deviceID.length() > 0) {
    Serial.println("📡 偵測到已保存的 deviceID，呼叫狀態 API");
    callDeviceStatusAPI(deviceID);
  } else {
    Serial.println("🔐 無 deviceID，呼叫 activate API");
    callActivateAPI(getChipId());
  }

  String finalDeviceID = preferences.getString("deviceID", "");
  bool hasDeviceIDFromBackend = (finalDeviceID.length() > 0);
  if (hasDeviceIDFromBackend) Serial.println("✅ 有 deviceID: " + finalDeviceID);
  else Serial.println("⚠️ 未從後端獲取到 deviceID");

  // 只有成功拿到 deviceID 才配置定時喚醒
  goToDeepSleep(savedConfig.refreshInterval, hasDeviceIDFromBackend);
}

void loop() {
  if (isAPMode) {
    server.handleClient();
    delay(10);
  }
}

// -------------------- helper functions --------------------

String getChipId() {
  uint64_t chipid = ESP.getEfuseMac();
  char chipIdStr[20];
  snprintf(chipIdStr, sizeof(chipIdStr), "%04X%08X", (uint16_t)(chipid >> 32), (uint32_t)chipid);
  return String(chipIdStr);
}

void loadWiFiCredentials() {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, true);
  wifi_ssid = wifiPrefs.getString("ssid", default_ssid);
  wifi_password = wifiPrefs.getString("password", default_password);
  wifiPrefs.end();
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("✅ WiFi 憑證已從 Preferences 載入");
    Serial.println("   SSID: " + wifi_ssid);
  } else {
    Serial.println("⚠️ WiFi 憑證未設置");
  }
}

void setWiFiCredentials(String ssid, String password) {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, false);
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("password", password);
  wifiPrefs.end();
  wifi_ssid = ssid; wifi_password = password;
  Serial.println("✅ WiFi 憑證已保存到 Preferences");
}

void loadSavedConfig() {
  savedConfig.success = preferences.getBool("success", false);
  savedConfig.isActivated = preferences.getBool("isActivated", false);
  savedConfig.needUpdate = preferences.getBool("needUpdate", false);
  savedConfig.refreshInterval = preferences.getInt("refreshInterval", 300);
  Serial.println("📂 載入保存的配置: isActivated=" + String(savedConfig.isActivated) + ", refreshInterval=" + String(savedConfig.refreshInterval));
}

void saveConfig(DeviceConfig config) {
  preferences.putBool("success", config.success);
  preferences.putBool("isActivated", config.isActivated);
  preferences.putBool("needUpdate", config.needUpdate);
  preferences.putInt("refreshInterval", config.refreshInterval);
  Serial.println("💾 配置已保存到持久化存儲");
}

// -------------------- AP mode (完整 HTML) --------------------

void startAPMode() {
  isAPMode = true;
  Serial.println("\n========== 啟動 AP 模式 ==========");
  Serial.println("📡 SSID: " + String(ap_ssid));
  Serial.println("🔑 密碼: " + String(ap_password));

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_password);

  IPAddress IP = WiFi.softAPIP();
  Serial.println("✅ AP 模式啟動成功");
  Serial.println("📍 AP IP 地址: " + IP.toString());
  Serial.println("🌐 配置頁面: http://" + IP.toString());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/config", HTTP_GET, handleConfig);

  server.begin();
  Serial.println("✅ Web 服務器已啟動");

  while (true) {
    server.handleClient();
    delay(10);
  }
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32 WiFi 配置</title>";
  html += "<style>";
  html += "body{font-family:Arial, sans-serif; background:#f5f5f5; padding:20px;}";
  html += ".container{max-width:600px;margin:30px auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}";
  html += "h1{text-align:center;color:#333}";
  html += "label{display:block;margin-top:12px;color:#444;font-weight:600}";
  html += "input{width:100%;padding:10px;margin-top:6px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box}";
  html += "button{width:100%;padding:12px;margin-top:18px;background:#007bff;color:#fff;border:none;border-radius:6px;font-size:16px}";
  html += ".note{background:#e9f7ff;padding:10px;border-radius:6px;margin-bottom:12px;color:#036}";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<h1>📡 ESP32 WiFi 配置</h1>";
  html += "<div class='note'><strong>請輸入 WiFi 憑證</strong><br>設備在配置完成後會自動重啟並嘗試連接 WiFi。</div>";
  html += "<form action='/save' method='POST'>";
  html += "<label for='ssid'>WiFi 名稱 (SSID)</label>";
  html += "<input type='text' id='ssid' name='ssid' placeholder='例如: MyWiFi' required>";
  html += "<label for='password'>WiFi 密碼</label>";
  html += "<input type='password' id='password' name='password' placeholder='請輸入密碼' required>";
  html += "<button type='submit'>💾 保存並重啟</button>";
  html += "</form>";
  html += "<hr>";
  html += "<p style='font-size:13px;color:#666'>若你想要手動設定其它參數，請透過序列埠或修改韌體後再上傳。</p>";
  html += "</div></body></html>";
  server.send(200, "text/html; charset=UTF-8", html);
}

void handleSave() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    String ssid = server.arg("ssid");
    String password = server.arg("password");
    ssid.trim(); password.trim();
    if (ssid.length() > 0 && password.length() > 0) {
      setWiFiCredentials(ssid, password);
      String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta http-equiv='refresh' content='5;url=/'><style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px}.c{max-width:600px;margin:50px auto;background:#fff;padding:20px;border-radius:8px;text-align:center}</style></head><body><div class='c'><h1>✅ 配置成功</h1><p>設備將在 5 秒後重啟並嘗試連接 WiFi。</p></div></body></html>";
      server.send(200, "text/html; charset=UTF-8", html);
      delay(2000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "SSID 和密碼不能為空");
    }
  } else {
    server.send(400, "text/plain", "缺少參數");
  }
}

void handleConfig() {
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

// -------------------- Activate & Status (整合短版顯示流程) --------------------

void callActivateAPI(String uniqueId) {
  Serial.println("\n========== 調用激活API ==========");
  Serial.println("📤 發送請求: POST /device/activate");
  Serial.println("🔑 unique_id: " + uniqueId);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(api_base_url) + "/device/activate";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.setTimeout(60000);
  http.useHTTP10(true);
  const char* headerKeys1[] = { "Content-Length", "Transfer-Encoding" };
  http.collectHeaders(headerKeys1, 2);
  http.setReuse(false);

  String postData = "unique_id=" + uniqueId;
  int httpCode = http.POST(postData);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("📥 HTTP 200，讀取響應...");
    
    // 檢查 Content-Length，如果太大就使用流式處理
    String contentLengthStr = http.header("Content-Length");
    String transferEncoding = http.header("Transfer-Encoding");
    int contentLength = contentLengthStr.toInt();
    Serial.println("   📊 Content-Length: " + String(contentLength) + " bytes");
    Serial.println("   📊 Transfer-Encoding: " + transferEncoding);
    Serial.println("   📊 可用內存: " + String(ESP.getFreeHeap()) + " bytes");
    
    // 如果 Content-Length 為 0 或不存在，可能是 chunked encoding，使用流式處理
    // 如果響應太大（超過 50000 字符）或內存不足，使用流式處理
    bool useStreaming = (contentLength == 0) || 
                        (contentLengthStr.length() == 0) ||
                        (transferEncoding.indexOf("chunked") >= 0) ||
                        (contentLength > 50000) || 
                        (ESP.getFreeHeap() < 100000);
    
    if (useStreaming) {
      Serial.println("🔄 響應較大，使用流式處理...");
      // 使用流式處理（類似 callDeviceStatusAPI）
      WiFiClient* stream = http.getStreamPtr();
      if (!stream) {
        Serial.println("❌ 無法獲取流對象");
        http.end();
        return;
      }
      
      // 等待數據開始傳輸
      unsigned long timeout = millis();
      while (stream->available() == 0 && (millis() - timeout) < 10000) {
        delay(10);
      }
      
      if (stream->available() == 0) {
        Serial.println("❌ 無數據可用");
        http.end();
        return;
      }
      
      // 流式解析 JSON 前綴
      String jsonPrefix = "";
      jsonPrefix.reserve(1000);
      
      bool success = false;
      bool alreadyActivated = false;
      String deviceID = "";
      String activation_code = "";
      String expire_at = "";
      int binSize = 0;
      bool foundBinData = false;
      
      const char* binDataMarker = "\"binData\":\"";
      int markerLen = strlen(binDataMarker);
      int markerMatch = 0;
      unsigned long lastDataTime = millis();
      
      while ((http.connected() || stream->available() > 0) && !foundBinData) {
        if (stream->available()) {
          char c = stream->read();
          lastDataTime = millis();
          
          if (c == binDataMarker[markerMatch]) {
            markerMatch++;
            if (markerMatch == markerLen) {
              foundBinData = true;
              Serial.println("✅ 找到 binData 標記");
              break;
            }
          } else {
            if (markerMatch > 0) {
              for (int i = 0; i < markerMatch; i++) {
                if (jsonPrefix.length() < 1000) {
                  jsonPrefix += binDataMarker[i];
                }
              }
              markerMatch = 0;
            }
            if (jsonPrefix.length() < 1000) {
              jsonPrefix += c;
            }
          }
        } else {
          delay(10);
          if (!http.connected() && (millis() - lastDataTime) > 2000) {
            break;
          }
        }
      }
      
      // 從 jsonPrefix 提取字段
      if (jsonPrefix.indexOf("\"success\":true") >= 0) success = true;
      if (jsonPrefix.indexOf("\"alreadyActivated\":true") >= 0) alreadyActivated = true;
      
      int deviceIDIdx = jsonPrefix.indexOf("\"deviceID\":\"");
      if (deviceIDIdx >= 0) {
        int startIdx = deviceIDIdx + 12;
        int endIdx = jsonPrefix.indexOf("\"", startIdx);
        if (endIdx > startIdx) deviceID = jsonPrefix.substring(startIdx, endIdx);
      }
      
      int activationCodeIdx = jsonPrefix.indexOf("\"activation_code\":\"");
      if (activationCodeIdx >= 0) {
        int startIdx = activationCodeIdx + 19;
        int endIdx = jsonPrefix.indexOf("\"", startIdx);
        if (endIdx > startIdx) activation_code = jsonPrefix.substring(startIdx, endIdx);
      }
      
      int expireAtIdx = jsonPrefix.indexOf("\"expire_at\":\"");
      if (expireAtIdx >= 0) {
        int startIdx = expireAtIdx + 13;
        int endIdx = jsonPrefix.indexOf("\"", startIdx);
        if (endIdx > startIdx) expire_at = jsonPrefix.substring(startIdx, endIdx);
      }
      
      int binSizeIdx = jsonPrefix.indexOf("\"binSize\":");
      if (binSizeIdx >= 0) {
        int startIdx = binSizeIdx + 10;
        int endIdx = jsonPrefix.indexOf(",", startIdx);
        if (endIdx < 0) endIdx = jsonPrefix.indexOf("}", startIdx);
        if (endIdx > startIdx) binSize = jsonPrefix.substring(startIdx, endIdx).toInt();
      }
      
      jsonPrefix = "";
      
      if (!success) {
        Serial.println("❌ success:false");
        http.end();
        return;
      }
      
      if (alreadyActivated) {
        if (deviceID.length() > 0) {
          preferences.putString("deviceID", deviceID);
          Serial.println("💾 已保存 deviceID: " + deviceID);
        }
        DeviceConfig newConfig;
        newConfig.success = true;
        newConfig.isActivated = true;
        newConfig.needUpdate = false;
        newConfig.refreshInterval = 300;
        newConfig.hasBinData = foundBinData;
        newConfig.binSize = binSize;
        saveConfig(newConfig);
        
        if (foundBinData && binSize > 0) {
          Serial.println("🔄 開始從 HTTP 流直接流式解碼 Base64...");
          int decodedLen = base64DecodeStreamingFromHTTPStream(stream, http, binSize);
          while (stream->available() > 0 || http.connected()) {
            if (stream->available()) stream->read();
            else delay(10);
          }
          http.end();
          if (decodedLen > 0) {
            Serial.println("✅ 流式解碼完成，總大小: " + String(decodedLen) + " bytes");
          }
        } else {
          while (stream->available() > 0 || http.connected()) {
            if (stream->available()) stream->read();
            else delay(10);
          }
          http.end();
        }
        
        // 收到 alreadyActivated: true 後，自動調用 status API
        if (deviceID.length() > 0) {
          Serial.println("🔄 設備已激活，自動調用 status API...");
          callDeviceStatusAPI(deviceID);
        }
      } else {
        if (activation_code.length() > 0) {
          activationInfo.activation_code = activation_code;
          activationInfo.expire_at = expire_at;
          activationInfo.isValid = true;
          preferences.putString("activation_code", activation_code);
          preferences.putString("expire_at", expire_at);
          preferences.putULong("last_activate_time", millis() / 1000);
          Serial.println("🔐 未激活，儲存激活碼：" + activation_code);
        }
        
        if (foundBinData && binSize > 0) {
          Serial.println("🔄 開始從 HTTP 流直接流式解碼 Base64...");
          int decodedLen = base64DecodeStreamingFromHTTPStream(stream, http, binSize);
          while (stream->available() > 0 || http.connected()) {
            if (stream->available()) stream->read();
            else delay(10);
          }
          http.end();
          if (decodedLen > 0) {
            Serial.println("✅ activate 的 binData 已成功顯示到 ePaper");
            Serial.println("   📊 解碼長度: " + String(decodedLen) + " bytes");
          }
        } else {
          while (stream->available() > 0 || http.connected()) {
            if (stream->available()) stream->read();
            else delay(10);
          }
          http.end();
          Serial.println("ℹ️ activate 回應中沒有 binData");
        }
      }
      return; // 流式處理完成，直接返回
    }
    
    // 小響應：使用原來的簡單方法
    Serial.println("📥 響應較小，使用簡單方法讀取...");
    String response = http.getString();
    size_t estimatedCapacity = response.length() * 2;
    DynamicJsonDocument doc(min(estimatedCapacity, (size_t)200000));
    DeserializationError error = deserializeJson(doc, response);
    if (error) {
      Serial.println("❌ JSON 解析錯誤: " + String(error.c_str()));
      Serial.println("   📊 響應長度: " + String(response.length()) + " 字符");
      Serial.println("   📊 可用內存: " + String(ESP.getFreeHeap()) + " bytes");
      http.end();
      return;
    }

    bool success = doc["success"] | false;
    if (!success) {
      String message = doc["message"] | "";
      Serial.println("❌ activate failed: " + message);
      activationInfo.isValid = false;
      http.end();
      return;
    }

    bool alreadyActivated = doc["alreadyActivated"] | false;
    if (alreadyActivated) {
      String deviceID = doc["deviceID"] | "";
      if (deviceID.length() > 0) {
        preferences.putString("deviceID", deviceID);
        Serial.println("💾 已保存 deviceID: " + deviceID);
      }

      DeviceConfig newConfig;
      newConfig.success = true;
      newConfig.isActivated = doc["isActivated"] | false;
      newConfig.needUpdate = doc["needUpdate"] | false;
      newConfig.refreshInterval = doc["refreshInterval"] | 300;
      newConfig.hasBinData = doc.containsKey("binData");
      newConfig.binSize = doc["binSize"] | 0;
      saveConfig(newConfig);

      // 若 activate 裡就帶 binData（通常短且可一次處理），做簡單處理
      if (newConfig.hasBinData) {
        String binData = doc["binData"] | "";
        if (binData.length() > 0) {
          Serial.println("🔄 activate 含 binData，嘗試簡單解碼後顯示 (小 payload)");
          // 針對短 payload：一次 decode -> 分塊 writeImagePart（此情況少見）
          int srcLen = binData.length();
          int maxOut = srcLen * 3 / 4 + 4;
          uint8_t* outBuf = (uint8_t*)malloc(maxOut);
          if (outBuf) {
            // 簡單 base64 decode（非最嚴謹但對小量可用）
            int qi = 0; char quartet[4];
            int outIdx = 0;
            for (int i = 0; i < srcLen; ++i) {
              char c = binData[i];
              if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
                quartet[qi++] = c;
                if (qi == 4) {
                  int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
                  int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
                  int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
                  int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
                  if (v0 >= 0 && v1 >= 0) {
                    outBuf[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
                    if (v2 != -2) {
                      outBuf[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
                    }
                    if (v3 != -2) {
                      outBuf[outIdx++] = ((v2 & 0x03) << 6) | v3;
                    }
                  }
                  qi = 0;
                }
              }
            }
            // 現在 outBuf[0..outIdx-1] 包含二進位，短版行為：分段讀 CHUNK_SIZE、CHUNK_SIZE (b then r) 並 writeImagePart
            int offset = 0;
            int round = 0;
            while (offset + CHUNK_SIZE * 2 <= outIdx) {
              display.writeImagePart(
                outBuf + offset, outBuf + offset + CHUNK_SIZE,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              offset += CHUNK_SIZE * 2;
              round++;
              delay(5);
            }
            free(outBuf);
            display.refresh();
            delay(12000);
            display.powerOff();
            Serial.println("✅ activate 的 binData 顯示完成");
          } else {
            Serial.println("❌ 分配 outBuf 失敗");
          }
        }
        
        // 收到 alreadyActivated: true 後，自動調用 status API
        if (deviceID.length() > 0) {
          Serial.println("🔄 設備已激活，自動調用 status API...");
          callDeviceStatusAPI(deviceID);
        }
      }
    } else {
      // 未激活 -> 保存激活資訊
      activationInfo.activation_code = doc["activation_code"] | "";
      activationInfo.expire_at = doc["expire_at"] | "";
      activationInfo.isValid = true;
      preferences.putString("activation_code", activationInfo.activation_code);
      preferences.putString("expire_at", activationInfo.expire_at);
      preferences.putULong("last_activate_time", millis() / 1000);
      Serial.println("🔐 未激活，儲存激活碼：" + activationInfo.activation_code);
      
      // 檢查是否有 binData，如果有則寫入 ePaper
      bool hasBinData = doc.containsKey("binData");
      int binSize = doc["binSize"] | 0;
      
      if (hasBinData && binSize > 0) {
        String binData = doc["binData"] | "";
        if (binData.length() > 0) {
          Serial.println("🔄 activate 含 binData，開始解碼並顯示到 ePaper");
          Serial.println("   📊 binSize: " + String(binSize) + " bytes");
          Serial.println("   📊 Base64 長度: " + String(binData.length()) + " 字符");
          
          // 使用流式解碼函數處理 binData
          int decodedLen = base64DecodeStreaming(binData, binSize);
          
          if (decodedLen > 0) {
            Serial.println("✅ activate 的 binData 已成功顯示到 ePaper");
            Serial.println("   📊 解碼長度: " + String(decodedLen) + " bytes");
          } else {
            Serial.println("❌ activate 的 binData 解碼失敗");
          }
        } else {
          Serial.println("⚠️ activate 的 binData 為空字符串");
        }
      } else {
        Serial.println("ℹ️ activate 回應中沒有 binData");
      }
    }
  } else {
    Serial.println("❌ activate HTTP 錯誤碼: " + String(httpCode));
  }
  http.end();
}

int b64val(char ch) {
  if (ch >= 'A' && ch <= 'Z') return ch - 'A';
  if (ch >= 'a' && ch <= 'z') return ch - 'a' + 26;
  if (ch >= '0' && ch <= '9') return ch - '0' + 52;
  if (ch == '+') return 62;
  if (ch == '/') return 63;
  if (ch == '=') return -2;
  return -1;
}

// 流式 Base64 解碼函數：從 response 字符串的指定範圍直接解碼，避免複製大字符串
// 返回解碼後的總數據長度
int base64DecodeStreamingFromResponse(const String& response, int startIdx, int endIdx, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  Serial.println("   📊 從 response[" + String(startIdx) + "] 到 response[" + String(endIdx) + "]");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int srcLen = endIdx - startIdx;
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  
  for (int i = 0; i < srcLen; ++i) {
    char c = response.charAt(startIdx + i);
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          outIdx++;
          
          if (v2 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
            outIdx++;
          }
          
          if (v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
            outIdx++;
          }
          
          // 當緩衝區滿了（達到 2 * CHUNK_SIZE），寫入顯示
          if (bufferIdx >= CHUNK_SIZE * 2) {
            display.writeImagePart(
              bBuf, rBuf,
              0, 0, 800, 8,
              0, round * 8, 800, 8,
              true, false, false
            );
            round++;
            Serial.printf("📤 已寫入第 %d 塊 (總共 %d bytes)\n", round, outIdx);
            bufferIdx = 0;
            delay(50);
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
    }
  }
  
  // 處理剩餘的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 確保紅色緩衝區正確
    int blackBytes = min(bufferIdx, CHUNK_SIZE);
    int redBytes = max(0, bufferIdx - CHUNK_SIZE);
    
    if (redBytes < CHUNK_SIZE) {
      memset(rBuf + redBytes, 0, CHUNK_SIZE - redBytes);
    }
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// 流式 Base64 解碼函數：邊解碼邊寫入顯示，避免大內存分配
// 返回解碼後的總數據長度
int base64DecodeStreaming(const String& base64Str, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int srcLen = base64Str.length();
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  
  for (int i = 0; i < srcLen; ++i) {
    char c = base64Str[i];
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          outIdx++;
          
          if (v2 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
            outIdx++;
          }
          
          if (v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
            outIdx++;
          }
          
          // 當緩衝區滿了（達到 2 * CHUNK_SIZE），寫入顯示
          if (bufferIdx >= CHUNK_SIZE * 2) {
            display.writeImagePart(
              bBuf, rBuf,
              0, 0, 800, 8,
              0, round * 8, 800, 8,
              true, false, false
            );
            round++;
            Serial.printf("📤 已寫入第 %d 塊 (總共 %d bytes)\n", round, outIdx);
            bufferIdx = 0;
            delay(50);
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
    }
  }
  
  // 處理剩餘的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 確保紅色緩衝區正確
    int blackBytes = min(bufferIdx, CHUNK_SIZE);
    int redBytes = max(0, bufferIdx - CHUNK_SIZE);
    
    if (redBytes < CHUNK_SIZE) {
      memset(rBuf + redBytes, 0, CHUNK_SIZE - redBytes);
    }
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// Base64 解碼函數：將 Base64 字符串解碼為二進位數據
// 返回解碼後的數據長度，如果失敗返回 -1
int base64Decode(const String& base64Str, uint8_t* output, int maxOutputLen) {
  int srcLen = base64Str.length();
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  
  for (int i = 0; i < srcLen && outIdx < maxOutputLen; ++i) {
    char c = base64Str[i];
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          if (outIdx >= maxOutputLen) break;
          output[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          
          if (v2 != -2) {
            if (outIdx >= maxOutputLen) break;
            output[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
          }
          
          if (v3 != -2) {
            if (outIdx >= maxOutputLen) break;
            output[outIdx++] = ((v2 & 0x03) << 6) | v3;
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0 && outIdx < maxOutputLen) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      output[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
      if (v2 >= 0 && outIdx < maxOutputLen) {
        output[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
      }
    }
  }
  
  return outIdx;
}

// 流式 Base64 解碼：從 HTTP 流直接讀取並解碼，邊讀邊寫入顯示
// 返回解碼後的總數據長度
int base64DecodeStreamingFromHTTPStream(WiFiClient* stream, HTTPClient& http, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  Serial.println("   📊 從 HTTP 流直接讀取 Base64 並解碼");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  unsigned long lastDataTime = millis();
  unsigned long startTime = millis();
  int base64CharsRead = 0;
  bool foundEndQuote = false;
  
  // 計算預期的 Base64 字符數（96000 bytes ≈ 128000 Base64 字符）
  int expectedBase64Chars = (expectedSize * 4 + 2) / 3;
  Serial.println("   📊 預期 Base64 字符數: ~" + String(expectedBase64Chars));
  
  // 從流中讀取 Base64 字符並實時解碼
  // 持續讀取直到：1) 連接關閉且無數據 2) 達到預期大小 3) 真正超時
  bool shouldContinue = true;
  int consecutiveEmptyReads = 0;
  const int MAX_EMPTY_READS = 100; // 連續 100 次空讀取（約 1 秒）才認為完成
  
  while (shouldContinue) {
    if (stream->available() > 0) {
      char c = stream->read();
      lastDataTime = millis();
      consecutiveEmptyReads = 0; // 重置空讀取計數
      
      // 跳過空白字符（但不計入 base64CharsRead）
      if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
      
      // 檢查是否為有效的 Base64 字符
      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
        base64CharsRead++; // 只對有效的 Base64 字符計數
        
        // 每讀取 10000 Base64 字符顯示一次進度
        if (base64CharsRead % 10000 == 0) {
          Serial.printf("   📊 已讀取: %d / ~%d Base64 字符，已解碼: %d / %d bytes (%.1f%%)\n", 
                        base64CharsRead, expectedBase64Chars, outIdx, expectedSize, 
                        (float)outIdx * 100.0 / expectedSize);
        }
        
        quartet[qi++] = c;
        if (qi == 4) {
          int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
          int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
          int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
          int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
          
          if (v0 >= 0 && v1 >= 0) {
            // 第一個字節：總是輸出
            buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
            outIdx++;
            
            // 檢查 buffer 是否滿了，如果滿了先寫入顯示
            if (bufferIdx >= CHUNK_SIZE * 2) {
              // 輸出 buffer 內容到 Serial（十六進制格式，全部連在一起）
              Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
              for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                if (buffer[i] < 0x10) Serial.print("0");
                Serial.print(buffer[i], HEX);
              }
              Serial.println();
              
              display.writeImagePart(
                bBuf, rBuf,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              round++;
              Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                           round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
              bufferIdx = 0;
              delay(50);
            }
            
            // 第二個字節：如果 v2 有效
            if (v2 != -2) {
              buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
              outIdx++;
              
              // 再次檢查 buffer 是否滿了
              if (bufferIdx >= CHUNK_SIZE * 2) {
                // 輸出 buffer 內容到 Serial
                Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
                for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                  if (buffer[i] < 0x10) Serial.print("0");
                  Serial.print(buffer[i], HEX);
                }
                Serial.println();
                
                display.writeImagePart(
                  bBuf, rBuf,
                  0, 0, 800, 8,
                  0, round * 8, 800, 8,
                  true, false, false
                );
                round++;
                Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                             round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
                bufferIdx = 0;
                delay(50);
              }
            }
            
            // 第三個字節：如果 v3 有效
            if (v3 != -2) {
              buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
              outIdx++;
              
              // 再次檢查 buffer 是否滿了
              if (bufferIdx >= CHUNK_SIZE * 2) {
                // 輸出 buffer 內容到 Serial
                Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
                for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                  if (buffer[i] < 0x10) Serial.print("0");
                  Serial.print(buffer[i], HEX);
                }
                Serial.println();
                
                display.writeImagePart(
                  bBuf, rBuf,
                  0, 0, 800, 8,
                  0, round * 8, 800, 8,
                  true, false, false
                );
                round++;
                Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                             round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
                bufferIdx = 0;
                delay(50);
              }
            }
          }
          qi = 0;
        }
      } else {
        // 遇到非 Base64 字符（如引號、逗號、}等）
        // 如果 quartet 中有字符，先處理它們，然後再跳過非 Base64 字符
        if (qi > 0) {
          // 處理當前不完整的 quartet
          int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
          int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
          int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
          int v3 = (qi > 3 && quartet[3] != '=') ? b64val(quartet[3]) : -2;
          
          if (v0 >= 0 && v1 >= 0) {
            if (bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
              outIdx++;
            }
            
            if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
              outIdx++;
            }
            
            if (v3 >= 0 && v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
              outIdx++;
            }
            
            // 如果緩衝區滿了，寫入顯示
            if (bufferIdx >= CHUNK_SIZE * 2) {
              // 輸出 buffer 內容到 Serial
              Serial.print("📦 Buffer[" + String(round) + "] (hex, 非Base64處理): ");
              for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                if (buffer[i] < 0x10) Serial.print("0");
                Serial.print(buffer[i], HEX);
              }
              Serial.println();
              
              display.writeImagePart(
                bBuf, rBuf,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              round++;
              Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                           round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
              bufferIdx = 0;
              delay(50);
            }
          }
          qi = 0; // 重置 quartet
        }
        // 跳過非 Base64 字符，繼續讀取（可能是 JSON 結束標記）
      }
    } else {
      // 沒有可用數據，等待一下
      delay(10);
      consecutiveEmptyReads++;
      
      unsigned long elapsed = millis() - lastDataTime;
      
      // 檢查是否應該繼續
      // 1. 如果已經解碼了足夠的數據（≥98%），且連接已關閉，且等待了足夠時間
      // 注意：不要提前退出，讓循環自然結束以處理 buffer 中的剩餘數據
      if (outIdx >= expectedSize * 0.98 && !http.connected() && consecutiveEmptyReads >= 50) {
        // 不立即退出，繼續等待直到真正完成或超時
        // 這樣可以確保 buffer 中的數據被處理
      }
      
      // 2. 如果連接已關閉，且連續多次沒有數據，認為完成
      if (!http.connected() && consecutiveEmptyReads >= MAX_EMPTY_READS) {
        Serial.println("⏱️ 連接已關閉且無數據，Base64 數據接收完成");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d / %d bytes (%.1f%%)\n", 
                     base64CharsRead, outIdx, expectedSize, 
                     (float)outIdx * 100.0 / expectedSize);
        Serial.printf("   📊 buffer 中還有 %d bytes 未寫入，將在循環結束後處理\n", bufferIdx);
        shouldContinue = false;
        break;
      }
      
      // 3. 如果連接還開著但超過 30 秒沒有新數據，認為超時（大幅增加超時時間）
      if (http.connected() && elapsed > 30000) {
        Serial.println("⏱️ 接收超時（30秒無數據），認為 Base64 數據已完整");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d / %d bytes (%.1f%%)\n", 
                     base64CharsRead, outIdx, expectedSize, 
                     (float)outIdx * 100.0 / expectedSize);
        shouldContinue = false;
        break;
      }
      
      // 4. 如果已經達到或超過預期大小，認為完成
      if (outIdx >= expectedSize) {
        Serial.println("✅ 已達到預期大小，Base64 數據接收完成");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d bytes\n", 
                     base64CharsRead, outIdx);
        shouldContinue = false;
        break;
      }
    }
  }
  
  Serial.printf("   ✅ Base64 讀取完成: %d 字符，解碼: %d bytes，耗時: %lu ms\n", 
                base64CharsRead, outIdx, millis() - startTime);
  Serial.printf("   📊 循環結束時: bufferIdx=%d, qi=%d\n", bufferIdx, qi);
  
  // 計算預期解碼大小
  int expectedDecoded = (base64CharsRead * 3) / 4;
  Serial.printf("   📊 預期解碼大小: %d bytes (從 %d Base64 字符)\n", expectedDecoded, base64CharsRead);
  Serial.printf("   📊 實際解碼大小: %d bytes，差異: %d bytes\n", outIdx, expectedDecoded - outIdx);
  
  // 處理剩餘的字符（最後不完整的 quartet）
  if (qi > 0) {
    Serial.printf("   🔍 處理剩餘 %d 個 Base64 字符\n", qi);
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    int v3 = (qi > 3 && quartet[3] != '=') ? b64val(quartet[3]) : -2;
    
    int beforeOutIdx = outIdx;
    if (v0 >= 0 && v1 >= 0) {
      // 第一個字節：總是輸出（如果有至少2個字符）
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      
      // 第二個字節：如果有3個字符
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
      
      // 第三個字節：如果有4個字符且第4個不是填充
      if (v3 >= 0 && v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
        outIdx++;
      }
    }
    Serial.printf("   ✅ 剩餘字符解碼完成，新增 %d bytes，總計: %d bytes\n", 
                 outIdx - beforeOutIdx, outIdx);
  }
  
  // 處理剩餘的數據（包括完整的塊）
  // 如果 buffer 中有完整的塊（bufferIdx >= CHUNK_SIZE * 2），先寫入
  while (bufferIdx >= CHUNK_SIZE * 2) {
    // 輸出 buffer 內容到 Serial
    Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
    for (int i = 0; i < CHUNK_SIZE * 2; i++) {
      if (buffer[i] < 0x10) Serial.print("0");
      Serial.print(buffer[i], HEX);
    }
    Serial.println();
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                 round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
    
    // 移動剩餘數據到 buffer 開頭
    if (bufferIdx > CHUNK_SIZE * 2) {
      memmove(buffer, buffer + CHUNK_SIZE * 2, bufferIdx - CHUNK_SIZE * 2);
      bufferIdx -= CHUNK_SIZE * 2;
    } else {
      bufferIdx = 0;
    }
    delay(50);
  }
  
  // 處理最後不足一個完整塊的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 輸出最後一塊 buffer 內容到 Serial
    Serial.print("📦 Buffer[" + String(round) + "] (最後一塊, hex): ");
    for (int i = 0; i < CHUNK_SIZE * 2; i++) {
      if (buffer[i] < 0x10) Serial.print("0");
      Serial.print(buffer[i], HEX);
    }
    Serial.println();
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// callDeviceStatusAPI: 真正的流式處理 - 邊讀邊處理，不存儲完整響應
void callDeviceStatusAPI(String deviceID) {
  Serial.println("\n========== 調用設備狀態API ==========");
  Serial.println("📤 發送請求: POST /device/status");
  Serial.println("🆔 deviceID: " + deviceID);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(api_base_url) + "/device/status";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("Accept", "application/json");
  http.addHeader("Accept-Encoding", "identity");
  http.addHeader("Connection", "close");
  http.setTimeout(120000);
  http.useHTTP10(true);
  http.setReuse(false);

  String postData = "deviceID=" + deviceID;
  int httpCode = http.POST(postData);
  Serial.println("📥 HTTP 響應碼: " + String(httpCode));
  if (httpCode != HTTP_CODE_OK) {
    Serial.println("❌ HTTP 錯誤: " + String(httpCode));
    http.end();
    return;
  }

  // 真正的流式處理：邊讀邊解析，不存儲完整響應
  Serial.println("📥 開始流式處理 HTTP 響應...");
  
  WiFiClient* stream = http.getStreamPtr();
  if (!stream) {
    Serial.println("❌ 無法獲取流對象");
    http.end();
    return;
  }

  // 等待數據開始傳輸
  unsigned long timeout = millis();
  while (stream->available() == 0 && (millis() - timeout) < 10000) {
    delay(10);
  }
  
  if (stream->available() == 0) {
    Serial.println("❌ 無數據可用");
    http.end();
    return;
  }
  
  // 流式解析 JSON 小字段（只讀取到 binData 之前）
  Serial.println("📋 開始流式解析 JSON...");
  
  bool success = false;
  bool isActivated = false;
  bool needUpdate = false;
  int refreshInterval = 300;
  int binSize = 0;
  int binDataStartPos = -1;
  
  // 使用小緩衝區讀取 JSON 前綴（到 binData 之前）
  String jsonPrefix = "";
  jsonPrefix.reserve(200); // 只預留小空間用於 JSON 前綴
  
  const char* binDataMarker = "\"binData\":\"";
  int markerLen = strlen(binDataMarker);
  int markerMatch = 0;
  bool foundBinData = false;
  
  // 流式讀取直到找到 binData 標記
  unsigned long lastDataTime = millis();
  while ((http.connected() || stream->available() > 0) && !foundBinData) {
    if (stream->available()) {
      char c = stream->read();
      lastDataTime = millis();
      
      // 檢查是否匹配 binData 標記
      if (c == binDataMarker[markerMatch]) {
        markerMatch++;
        if (markerMatch == markerLen) {
          // 找到 binData 標記！
          binDataStartPos = jsonPrefix.length() + markerLen - 10; // 調整位置
          foundBinData = true;
          Serial.println("✅ 找到 binData 標記，位置: " + String(jsonPrefix.length()));
      break;
        }
    } else {
        // 重置匹配
        if (markerMatch > 0) {
          // 將之前匹配的部分添加到 jsonPrefix
          for (int i = 0; i < markerMatch; i++) {
            if (jsonPrefix.length() < 200) {
              jsonPrefix += binDataMarker[i];
            }
          }
          markerMatch = 0;
        }
        
        // 添加到前綴（只保存前 200 字符用於解析小字段）
        if (jsonPrefix.length() < 200) {
          jsonPrefix += c;
        }
      }
    } else {
      delay(10);
      if (!http.connected() && (millis() - lastDataTime) > 2000) {
        break;
      }
    }
  }
  
  // 從 jsonPrefix 中提取小字段
  if (jsonPrefix.indexOf("\"success\":true") >= 0) {
    success = true;
  }
  if (jsonPrefix.indexOf("\"isActivated\":true") >= 0) {
    isActivated = true;
  }
  if (jsonPrefix.indexOf("\"needUpdate\":true") >= 0) {
    needUpdate = true;
  }
  
  // 提取 refreshInterval
  int refreshIdx = jsonPrefix.indexOf("\"refreshInterval\":");
  if (refreshIdx >= 0) {
    int startIdx = refreshIdx + 18;
    int endIdx = jsonPrefix.indexOf(",", startIdx);
    if (endIdx < 0) endIdx = jsonPrefix.indexOf("}", startIdx);
    if (endIdx > startIdx) {
      refreshInterval = jsonPrefix.substring(startIdx, endIdx).toInt();
    }
  }
  
  // 提取 binSize
  int binSizeIdx = jsonPrefix.indexOf("\"binSize\":");
  if (binSizeIdx >= 0) {
    int startIdx = binSizeIdx + 10;
    int endIdx = jsonPrefix.indexOf(",", startIdx);
    if (endIdx < 0) endIdx = jsonPrefix.indexOf("}", startIdx);
    if (endIdx > startIdx) {
      binSize = jsonPrefix.substring(startIdx, endIdx).toInt();
    }
  }
  
  Serial.println("✅ 流式解析 JSON 前綴成功:");
  Serial.println("   - success: " + String(success));
  Serial.println("   - isActivated: " + String(isActivated));
  Serial.println("   - needUpdate: " + String(needUpdate));
  Serial.println("   - refreshInterval: " + String(refreshInterval));
  Serial.println("   - binSize: " + String(binSize));
  Serial.println("   - foundBinData: " + String(foundBinData));
  
  // 清理 jsonPrefix 以釋放內存
  jsonPrefix = "";
  
  // 處理解析結果
  if (!success) {
    Serial.println("❌ success:false");
    
    // 當 success=false 時（通常是設備不存在），清除 deviceID 並重新進入激活流程
    // 保存 isActivated = false 的狀態到本地配置
    savedConfig.isActivated = false;
    savedConfig.needUpdate = false;
    saveConfig(savedConfig);
    Serial.println("💾 已保存 isActivated=false 到本地配置");
    
    String existingId = preferences.getString("deviceID", "");
    if (existingId.length() > 0) {
      preferences.remove("deviceID");
      Serial.println("🗑️ 已清除保存的 deviceID");
    }
    String uniqueIdNow = getChipId();
    Serial.println("🔁 success=false，重新進入激活流程，unique_id=" + uniqueIdNow);
    http.end();
    callActivateAPI(uniqueIdNow);
    return;
  }

  if (!isActivated) {
    // 保存 isActivated = false 的狀態到本地配置
    savedConfig.isActivated = false;
    savedConfig.needUpdate = false;
    saveConfig(savedConfig);
    Serial.println("💾 已保存 isActivated=false 到本地配置");
    
    String existingId = preferences.getString("deviceID", "");
    if (existingId.length() > 0) {
      preferences.remove("deviceID");
      Serial.println("🗑️ 已清除保存的 deviceID");
    }
    String uniqueIdNow = getChipId();
    Serial.println("🔁 isActivated=false，重新進入激活流程，unique_id=" + uniqueIdNow);
    http.end();
    callActivateAPI(uniqueIdNow);
    return;
  }

  // 如果有 binData，直接從流中流式解碼
  if (foundBinData && needUpdate) {
    Serial.println("📊 binData 信息:");
    Serial.println("   - 預期 binSize: " + String(binSize) + " bytes");
    Serial.println("   📊 可用內存: " + String(ESP.getFreeHeap()) + " bytes");
    
    Serial.println("🔄 開始從 HTTP 流直接流式解碼 Base64...");
    
    // 直接從 HTTP 流讀取 Base64 並解碼
    int decodedLen = base64DecodeStreamingFromHTTPStream(stream, http, binSize);
    
    // 讀取並丟棄剩餘數據（直到連接關閉）
    while (stream->available() > 0 || http.connected()) {
      if (stream->available()) {
        stream->read(); // 丟棄剩餘數據
      } else {
        delay(10);
        if (!http.connected() && (millis() - lastDataTime) > 2000) {
          break;
        }
      }
    }
    
    http.end();
    
    if (decodedLen > 0) {
      Serial.println("✅ 流式解碼完成，總大小: " + String(decodedLen) + " bytes");
      
      // 發送渲染完成消息給服務器（在display.refresh()和powerOff()完成後）
      sendRenderCompleteMessage(deviceID, "success", "");
    } else {
      Serial.println("❌ 流式解碼失敗");
      // 發送渲染失敗消息
      sendRenderCompleteMessage(deviceID, "failed", "Stream decode failed");
    }
    
    // 更新配置
    savedConfig.isActivated = true;
    savedConfig.needUpdate = needUpdate;
    savedConfig.refreshInterval = refreshInterval;
    savedConfig.hasBinData = true;
    savedConfig.binSize = binSize;
    saveConfig(savedConfig);
    return;
        } else {
    // 沒有 binData，讀取並丟棄剩餘響應
    while (stream->available() > 0 || http.connected()) {
      if (stream->available()) {
        stream->read();
        } else {
        delay(10);
      }
    }
    http.end();
    
    Serial.println("ℹ️ 無需更新或無 binData");
    // 即使不需要更新，也發送渲染完成消息（表示設備已檢查並確認無需更新）
    sendRenderCompleteMessage(deviceID, "success", "");
  }

  // 更新 savedConfig 與持久化
  savedConfig.isActivated = true;
  savedConfig.needUpdate = needUpdate;
  savedConfig.refreshInterval = refreshInterval;
  savedConfig.hasBinData = false;
  savedConfig.binSize = binSize;
  saveConfig(savedConfig);
  return;
}

// 十六進制字符轉字節
uint8_t hexCharToByte(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return 0;
}

// 從 PROGMEM 讀取字符
char readProgMemChar(const char* str, int idx) {
  return pgm_read_byte_near(str + idx);
}

// RLE 解壓並顯示默認圖像
void displayDefaultImage() {
  Serial.println("\n========== 顯示默認圖像 ==========");
  Serial.println("📺 開始解壓並顯示默認圖像數據");
  
  // 檢查壓縮數據是否已設置
  if (defaultImageCompressedLen == 0) {
    Serial.println("⚠️ 默認圖像數據未設置，跳過顯示");
    return;
  }
  
  // 分配緩衝區（和 binData 一樣的格式：連續寫入，前 CHUNK_SIZE 是黑色，後 CHUNK_SIZE 是紅色）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int totalBytes = 0;
  int bufferIdx = 0;  // 連續寫入 buffer，和 binData 一樣
  int round = 0;
  int compressedIdx = 0;
  int zeroTailRemaining = defaultImageZeroTailLen;
  
  Serial.println("   📊 壓縮數據長度: " + String(defaultImageCompressedLen) + " 字符");
  Serial.println("   📊 後續0長度: " + String(defaultImageZeroTailLen) + " 字符");
  Serial.println("   📊 總字節數: " + String(defaultImageTotalBytes) + " bytes");
  
  // 解析 RLE 壓縮數據（解壓後前 96000 字節是黑色數據，後 96000 字節是紅色數據（全0））
  int decodedFromCompressed = 0;  // 從壓縮數據解出的字節數
  bool printFirstBytes = true;   // 是否打印前幾個字節
  int bytesToPrint = 100;         // 打印前多少個字節
  int bytesPrinted = 0;           // 已打印的字節數
  
  Serial.println("   🔍 開始解壓，將打印前 " + String(bytesToPrint) + " 個字節的十六進制值");
  
  while (compressedIdx < defaultImageCompressedLen && totalBytes < defaultImageTotalBytes) {
    char c1 = readProgMemChar(defaultImageCompressed, compressedIdx);
    
    if (c1 == '\0') {
      Serial.println("⚠️ 遇到字符串結束符，停止解壓");
      break; // 字符串結束
    }
    
    // 檢查是否為連續0標記 "(N)"
    if (c1 == '(') {
      // 找到 "(" 標記，讀取數字直到 ")"
      compressedIdx++;
      int zeroCount = 0;
      while (compressedIdx < defaultImageCompressedLen) {
        char digit = readProgMemChar(defaultImageCompressed, compressedIdx);
        if (digit == ')') {
          compressedIdx++; // 跳過 ")"
          break; // 結束
        }
        if (digit >= '0' && digit <= '9') {
          zeroCount = zeroCount * 10 + (digit - '0');
          compressedIdx++;
        } else {
          break; // 遇到非數字字符，結束
        }
      }
      
      // 打印前幾個零字節
      if (printFirstBytes && bytesPrinted < bytesToPrint) {
        Serial.print("   [連續0: " + String(zeroCount) + " 個] ");
        int printCount = min(zeroCount, bytesToPrint - bytesPrinted);
        for (int p = 0; p < printCount && p < 20; p++) {  // 最多打印20個
          Serial.print("00 ");
        }
        if (zeroCount > 20) Serial.print("...");
        Serial.println();
        bytesPrinted += printCount;
        if (bytesPrinted >= bytesToPrint) {
          printFirstBytes = false;
          Serial.println("   ... (後續字節不再打印)");
        }
      }
      
      // 填充連續的0（連續寫入 buffer，和 binData 一樣）
      for (int i = 0; i < zeroCount && totalBytes < defaultImageTotalBytes; i++) {
        if (bufferIdx >= CHUNK_SIZE * 2) {
          // 緩衝區滿了，寫入顯示
          display.writeImagePart(
            bBuf, rBuf,
            0, 0, 800, 8,
            0, round * 8, 800, 8,
            true, false, false
          );
          round++;
          bufferIdx = 0;
          delay(50);
        }
        buffer[bufferIdx++] = 0;
        totalBytes++;
        decodedFromCompressed++;
      }
      continue;
    }
    
    // 讀取兩個十六進制字符組成一個字節
    if (compressedIdx + 1 < defaultImageCompressedLen) {
      char c2 = readProgMemChar(defaultImageCompressed, compressedIdx + 1);
      uint8_t byte = (hexCharToByte(c1) << 4) | hexCharToByte(c2);
      
      // 打印前幾個非零字節
      if (printFirstBytes && bytesPrinted < bytesToPrint) {
        if (bytesPrinted % 16 == 0) {
          Serial.print("   [" + String(bytesPrinted) + "] ");
        }
        if (byte < 0x10) Serial.print("0");
        Serial.print(byte, HEX);
        Serial.print(" ");
        bytesPrinted++;
        if (bytesPrinted % 16 == 0) {
          Serial.println();
        }
        if (bytesPrinted >= bytesToPrint) {
          printFirstBytes = false;
          Serial.println();
          Serial.println("   ... (後續字節不再打印)");
        }
      }
      
      if (bufferIdx >= CHUNK_SIZE * 2) {
        // 緩衝區滿了，寫入顯示
        display.writeImagePart(
          bBuf, rBuf,
          0, 0, 800, 8,
          0, round * 8, 800, 8,
          true, false, false
        );
        round++;
        bufferIdx = 0;
        delay(50);
      }
      
      buffer[bufferIdx++] = byte;
      totalBytes++;
      decodedFromCompressed++;
      compressedIdx += 2;
    } else {
      Serial.println("⚠️ 壓縮數據不完整，無法讀取完整的十六進制字節");
      break; // 數據不完整
    }
  }
  
  if (bytesPrinted % 16 != 0 && bytesPrinted < bytesToPrint) {
    Serial.println();
  }
  
  Serial.println("   📊 從壓縮數據解出: " + String(decodedFromCompressed) + " bytes");
  
  // 打印 buffer 的前幾個字節（驗證寫入是否正確）
  Serial.println("   🔍 驗證 buffer 前 64 個字節:");
  Serial.print("   ");
  for (int i = 0; i < 64 && i < bufferIdx; i++) {
    if (buffer[i] < 0x10) Serial.print("0");
    Serial.print(buffer[i], HEX);
    Serial.print(" ");
    if ((i + 1) % 16 == 0) {
      Serial.println();
      Serial.print("   ");
    }
  }
  Serial.println();
  
  // 填充後續的0（如果還有剩餘空間）
  while (zeroTailRemaining > 0 && totalBytes < defaultImageTotalBytes) {
    if (bufferIdx >= CHUNK_SIZE * 2) {
      // 緩衝區滿了，寫入顯示
      display.writeImagePart(
        bBuf, rBuf,
        0, 0, 800, 8,
        0, round * 8, 800, 8,
        true, false, false
      );
      round++;
      bufferIdx = 0;
      delay(50);
    }
    buffer[bufferIdx++] = 0;
    totalBytes++;
    zeroTailRemaining -= 2; // 每個字節對應2個十六進制字符
  }
  
  // 如果總字節數還沒到 192000，填充剩餘部分（紅色部分全0）
  while (totalBytes < defaultImageTotalBytes) {
    if (bufferIdx >= CHUNK_SIZE * 2) {
      display.writeImagePart(
        bBuf, rBuf,
        0, 0, 800, 8,
        0, round * 8, 800, 8,
        true, false, false
      );
      round++;
      bufferIdx = 0;
      delay(50);
    }
    buffer[bufferIdx++] = 0;
    totalBytes++;
  }
  
  // 處理剩餘的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
  }
  
  free(buffer);
  
  // 刷新顯示
  display.refresh();
  delay(12000);
  display.powerOff();
  
  Serial.println("✅ 默認圖像顯示完成");
  Serial.println("   📊 總共寫入: " + String(totalBytes) + " bytes");
  Serial.println("   📊 從壓縮數據解出: " + String(decodedFromCompressed) + " bytes");
  Serial.println("   📊 總共 " + String(round) + " 塊");
  if (totalBytes != defaultImageTotalBytes) {
    Serial.println("⚠️ 警告：總字節數不匹配！預期: " + String(defaultImageTotalBytes) + ", 實際: " + String(totalBytes));
  }
  Serial.println("========== 默認圖像顯示完成 ==========\n");
}

// 發送渲染完成消息給服務器
void sendRenderCompleteMessage(String deviceID, String status, String errorMessage) {
  if (deviceID.length() == 0) {
    Serial.println("⚠️ 無 deviceID，跳過發送渲染完成消息");
    return;
  }
  
  Serial.println("\n========== 發送渲染完成消息 ==========");
  Serial.println("📤 發送請求: POST /device/render-complete");
  Serial.println("🆔 deviceID: " + deviceID);
  Serial.println("📊 status: " + status);
  if (errorMessage.length() > 0) {
    Serial.println("❌ errorMessage: " + errorMessage);
  }
  
  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  String url = String(api_base_url) + "/device/render-complete";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("Accept", "application/json");
  http.setTimeout(10000);
  
  String postData = "deviceID=" + deviceID + "&status=" + status;
  if (errorMessage.length() > 0) {
    postData += "&errorMessage=" + errorMessage;
  }
  
  int httpCode = http.POST(postData);
  Serial.println("📥 HTTP 響應碼: " + String(httpCode));
  
  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.println("✅ 渲染完成消息發送成功");
    Serial.println("📥 響應: " + response);
  } else {
    Serial.println("❌ 渲染完成消息發送失敗: " + String(httpCode));
  }
  
  http.end();
}

// goToDeepSleep：計算實際休眠時間（refreshInterval - 已運行時間）
void goToDeepSleep(int sleepSeconds, bool isActivated) {
  Serial.println("\n========== 準備進入深度睡眠 ==========");
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN_1, 0);
  Serial.println("🔘 已配置按鈕1喚醒");
  
  if (isActivated) {
    if (sleepSeconds <= 0) sleepSeconds = 300;
    
    // 計算已運行時間（從設備啟動到現在）
    unsigned long elapsedTime = millis() - deviceStartTime;
    unsigned long elapsedSeconds = elapsedTime / 1000;
    
    // 計算實際休眠時間 = refreshInterval - 已運行時間
    int actualSleepSeconds = sleepSeconds - elapsedSeconds;
    
    // 確保實際休眠時間 >= 0（如果已運行時間超過 refreshInterval，設置為最小1秒）
    if (actualSleepSeconds < 1) {
      actualSleepSeconds = 1;
    }
    
    Serial.println("⏱️ 設備已運行時間: " + String(elapsedSeconds) + " 秒");
    Serial.println("⏰ 原始刷新間隔: " + String(sleepSeconds) + " 秒");
    Serial.println("⏰ 實際休眠時間: " + String(actualSleepSeconds) + " 秒");
    Serial.println("✅ 總時間（運行 + 休眠）: " + String(elapsedSeconds + actualSleepSeconds) + " 秒");
    
    esp_sleep_enable_timer_wakeup((uint64_t)actualSleepSeconds * 1000000ULL);
  } else {
    Serial.println("⚠️ 設備未激活，僅配置按鈕喚醒");
  }
  
  Serial.println("😴 進入深度睡眠...");
  delay(1000);
  esp_deep_sleep_start();
}
