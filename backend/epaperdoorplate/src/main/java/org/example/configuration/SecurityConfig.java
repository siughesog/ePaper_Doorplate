package org.example.configuration;

import org.example.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.config.Customizer;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    // 從環境變數讀取允許的 CORS 來源
    // 格式：用逗號分隔的多個域名，例如：https://example.com,https://www.example.com
    // ⚠️ 生產環境必須設置，且只允許 https:// 協議的域名
    // ⚠️ 不允許 localhost 和 * 通配符
    @Value("${ALLOWED_ORIGINS:}")
    private String allowedOrigins;
    
    // 是否允許 localhost（開發環境使用）
    // 默認為 true，方便本地開發調試
    // 生產環境應設置為 false
    @Value("${ALLOW_LOCALHOST:true}")
    private boolean allowLocalhost;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // 添加 HTTP 安全標頭
            .headers(headers -> headers
                .contentTypeOptions(Customizer.withDefaults())  // X-Content-Type-Options: nosniff
                .frameOptions(frame -> frame.deny())  // X-Frame-Options: DENY
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31536000)  // 1年
                )
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
            )
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/", "/favicon.ico", "/error").permitAll()  // 允许根路径和错误页面
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .requestMatchers("/images/**").permitAll()
                .requestMatchers("/device/activate").permitAll()
                .requestMatchers("/device/status").permitAll()
                .requestMatchers("/device/bind").authenticated()
                .requestMatchers("/device/unbind").authenticated()
                .requestMatchers("/device/update").authenticated()
                .requestMatchers("/device/update-template").authenticated()
                .requestMatchers("/device/list").authenticated()
                // OPTIONS 预检请求允许所有
                .requestMatchers(request -> "OPTIONS".equalsIgnoreCase(request.getMethod())).permitAll()
                .requestMatchers("/api/images/**").authenticated()
                .requestMatchers("/api/doorplate/**").authenticated()
                .requestMatchers("/api/display/**").authenticated()
                .requestMatchers("/api/text-library/**").authenticated()
                .requestMatchers("/api/image-library/**").authenticated()
                .requestMatchers("/layout/**").authenticated()
                .requestMatchers("/render/**").authenticated()
                .requestMatchers("/textLibrary/**").authenticated()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        List<String> origins = new java.util.ArrayList<>();
        
        // 如果允許 localhost（開發環境），添加常見的 localhost 地址
        if (allowLocalhost) {
            origins.add("http://localhost:3000");
            origins.add("https://localhost:3000");
            origins.add("http://localhost:8080");
            origins.add("https://localhost:8080");
            origins.add("http://127.0.0.1:3000");
            origins.add("https://127.0.0.1:3000");
            origins.add("http://127.0.0.1:8080");
            origins.add("https://127.0.0.1:8080");
            System.out.println("🔧 開發模式：已允許 localhost 訪問");
        }
        
        // 從環境變數讀取允許的來源
        if (allowedOrigins != null && !allowedOrigins.trim().isEmpty()) {
            // 解析並驗證逗號分隔的域名列表
            List<String> configuredOrigins = Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .filter(origin -> isValidOrigin(origin, allowLocalhost)) // 驗證域名格式
                    .collect(Collectors.toList());
            
            origins.addAll(configuredOrigins);
        }
        
        if (origins.isEmpty()) {
            if (!allowLocalhost && (allowedOrigins == null || allowedOrigins.trim().isEmpty())) {
                // 生產環境且未設置 ALLOWED_ORIGINS
                System.out.println("⚠️ 警告: ALLOWED_ORIGINS 未設置，且 ALLOW_LOCALHOST=false");
                System.out.println("   CORS 將拒絕所有請求");
                System.out.println("   請在環境變數中設置 ALLOWED_ORIGINS，例如：");
                System.out.println("   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com");
            }
            configuration.setAllowedOrigins(Arrays.asList()); // 空列表，拒絕所有
        } else {
            System.out.println("✅ CORS 已配置，允許的來源: " + origins);
            configuration.setAllowedOrigins(origins);
        }
        
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);  // 预检请求缓存时间

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
    
    /**
     * 驗證 CORS 來源是否有效
     * 規則：
     * 1. 不能是 * 通配符
     * 2. 生產環境：必須以 https:// 開頭，不能包含 localhost
     * 3. 開發環境（allowLocalhost=true）：允許 http:// 和 https://，允許 localhost
     * 
     * @param origin 來源域名
     * @param allowLocalhost 是否允許 localhost
     * @return 是否有效
     */
    private boolean isValidOrigin(String origin, boolean allowLocalhost) {
        // 拒絕 * 通配符
        if ("*".equals(origin)) {
            System.err.println("❌ 拒絕無效的 CORS 來源: * (不允許通配符)");
            return false;
        }
        
        // 檢查是否包含 localhost
        boolean isLocalhost = origin.contains("localhost") || origin.contains("127.0.0.1");
        
        // 如果包含 localhost 但不允許，則拒絕
        if (isLocalhost && !allowLocalhost) {
            System.err.println("❌ 拒絕無效的 CORS 來源: " + origin + " (生產環境不允許 localhost)");
            return false;
        }
        
        // 生產環境（不允許 localhost）：必須以 https:// 開頭
        if (!allowLocalhost && !origin.startsWith("https://")) {
            System.err.println("❌ 拒絕無效的 CORS 來源: " + origin + " (生產環境必須以 https:// 開頭)");
            return false;
        }
        
        // 開發環境（允許 localhost）：允許 http:// 或 https://
        if (allowLocalhost && !origin.startsWith("http://") && !origin.startsWith("https://")) {
            System.err.println("❌ 拒絕無效的 CORS 來源: " + origin + " (必須以 http:// 或 https:// 開頭)");
            return false;
        }
        
        // 基本格式驗證
        String protocol = origin.startsWith("https://") ? "https://" : "http://";
        String domain = origin.substring(protocol.length());
        if (domain.isEmpty() || domain.contains(" ")) {
            System.err.println("❌ 拒絕無效的 CORS 來源: " + origin + " (域名格式錯誤)");
            return false;
        }
        
        return true;
    }
}
