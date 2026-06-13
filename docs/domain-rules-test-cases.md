# Domain Rules Test Cases

## Ordenes

- Orden cobrada pero no retirada -> PDF bloqueado
- Orden sin garantía -> PDF bloqueado
- Orden sin cliente -> PDF bloqueado
- Orden entregada con datos completos -> PDF permitido
- Orden cancelada -> PDF bloqueado

## Comprobantes

- Comprobante sin `pdfUrl` -> no publicable
- Comprobante sin trazabilidad -> no verificable
- Comprobante completo -> verificable

## Beneficios

- Beneficio vencido -> no aplicable
- Beneficio usado -> no aplicable
- Beneficio de otra moto -> no aplicable
- Beneficio disponible para misma moto/taller/cliente -> aplicable
