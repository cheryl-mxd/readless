from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


ProviderName = Literal["qwen", "openai", "gemini", "claude"]
LanguageName = Literal["English", "Simplified Chinese"]
TemplateName = Literal["default-template", "obsidian", "custom"]


class SummarizeUrlRequest(BaseModel):
    url: HttpUrl
    provider: ProviderName
    apiKey: str = Field(min_length=1)
    template: TemplateName = "default-template"
    language: LanguageName = "Simplified Chinese"
    model: str | None = None
    customTemplate: str | None = None
    contentLimit: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_custom_template(self) -> "SummarizeUrlRequest":
        if self.template == "custom" and not (self.customTemplate or "").strip():
            raise ValueError("customTemplate is required when template is 'custom'.")
        return self


class SummarizeResponse(BaseModel):
    title: str
    filename: str
    summary: str
    sourceType: Literal["url", "pdf"]
    provider: ProviderName
    model: str


class ProviderInfo(BaseModel):
    models: list[str]
    default: str


class ProvidersResponse(BaseModel):
    providers: dict[ProviderName, ProviderInfo]
    templates: list[str]
    languages: list[LanguageName]
    templateContents: dict[str, str]
    defaultContentLimit: int
