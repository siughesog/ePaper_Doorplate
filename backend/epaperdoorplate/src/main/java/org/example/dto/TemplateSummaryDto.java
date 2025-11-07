package org.example.dto;

public class TemplateSummaryDto {
    private String id;
    private String name;
    private String url; // ✅ 新增 url 欄位

    public TemplateSummaryDto(String id, String name, String url) {
        this.id = id;
        this.name = name;
        this.url = url;
    }

    // 原本只支援 id 和 name 的建構子（如果其他地方有用到可以保留）
    public TemplateSummaryDto(String id, String name) {
        this.id = id;
        this.name = name;
    }

    // getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
