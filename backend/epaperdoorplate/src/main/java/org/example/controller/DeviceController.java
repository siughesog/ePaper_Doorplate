package org.example.controller;

import org.example.service.DeviceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/device")
public class DeviceController {

    @Autowired
    private DeviceService deviceService;

    @PostMapping("/activate")
    public ResponseEntity<Map<String, Object>> activate(@RequestParam("unique_id") String uniqueId) {
        return ResponseEntity.ok(deviceService.activate(uniqueId));
    }

    @PostMapping("/bind")
    public ResponseEntity<Map<String, Object>> bind(@RequestParam("activation_code") String activationCode,
                                                    @RequestParam("deviceName") String deviceName,
                                                    @RequestParam("username") String username) {
        return ResponseEntity.ok(deviceService.bind(activationCode, deviceName, username));
    }

    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> update(@RequestParam("deviceID") String deviceId,
                                                      @RequestParam(value = "deviceName", required = false) String deviceName,
                                                      @RequestParam(value = "refreshInterval", required = false) Integer refreshInterval,
                                                      @RequestParam(value = "forceNoUpdate", required = false) Boolean forceNoUpdate) {
        return ResponseEntity.ok(deviceService.update(deviceId, deviceName, refreshInterval, forceNoUpdate));
    }

    @PostMapping("/unbind")
    public ResponseEntity<Map<String, Object>> unbind(@RequestParam("deviceID") String deviceId) {
        return ResponseEntity.ok(deviceService.unbind(deviceId));
    }

    @PostMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam("deviceID") String deviceId) {
        return ResponseEntity.ok(deviceService.status(deviceId));
    }

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> getUserDevices(@RequestParam("username") String username) {
        return ResponseEntity.ok(deviceService.getUserDevices(username));
    }

    @PostMapping("/update-template")
    public ResponseEntity<Map<String, Object>> updateDeviceTemplate(@RequestParam("deviceID") String deviceId,
                                                                    @RequestParam("templateId") String templateId) {
        return ResponseEntity.ok(deviceService.updateDeviceTemplate(deviceId, templateId));
    }
}


