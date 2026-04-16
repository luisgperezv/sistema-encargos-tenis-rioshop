$token = "EAAMx3AqOky8BRPadegWQnbIWMLIXLOn6HvXFAe7ijXs6A9CCRRH53AkSQbv0B881yZA8onKyWGcBK4IlNCjlxlGe5mvmJopGTUIMXzB8MJ4X8Kg55cemX6P4VJA6q7QrxCZAFlBgJtrzbZA4fRLhhtjqcYsy2boXE0lXGTGApxwTvC8iYiBKeUwzpY48ExlAiEMVZBbyYY6GtxMsA2rdXKZADBZBgPJqZBiPRJOgpzvlP8jgg4MrjRIN7UcfYqrsVGTJnvQZActPUNuqLTu7yEviOKpu"

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$bodyObject = @{
    messaging_product = "whatsapp"
    to = "573242697263"
    type = "template"
    template = @{
        name = "confirmacion_encargo"
        language = @{
            code = "es"
        }
        components = @(
            @{
                type = "body"
                parameters = @(
                    @{ type = "text"; text = "Luis" },
                    @{ type = "text"; text = "Nike Panda" },
                    @{ type = "text"; text = "39" },
                    @{ type = "text"; text = "40" },
                    @{ type = "text"; text = "200000" },
                    @{ type = "text"; text = "50000" },
                    @{ type = "text"; text = "150000" },
                    @{ type = "text"; text = "20/04/2026" }
                )
            }
        )
    }
}

$body = $bodyObject | ConvertTo-Json -Depth 10

Write-Host "Enviando request a WhatsApp API..."
Write-Host $body

Invoke-RestMethod -Method POST `
    -Uri "https://graph.facebook.com/v25.0/1061435200388299/messages" `
    -Headers $headers `
    -Body $body