package org.example.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> root() {
        Map<String, Object> response = new HashMap<>();
        response.put("name", "ePaper Doorplate API");
        response.put("version", "1.0.0");
        response.put("status", "running");
        response.put("message", "API Server is running. Use /api/auth/login to authenticate.");
        
        // 使用 HashMap 而不是 Map.of() 以确保兼容性
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("auth", "/api/auth");
        endpoints.put("devices", "/device");
        endpoints.put("layouts", "/layout");
        endpoints.put("images", "/api/images");
        endpoints.put("render", "/render");
        response.put("endpoints", endpoints);
        
        return ResponseEntity.ok(response);
    }
}

