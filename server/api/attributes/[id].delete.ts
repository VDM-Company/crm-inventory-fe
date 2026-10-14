/** 409 `in_use` when any product or variant has ever used one of its options. */
export default defineEventHandler(event =>
  vertexRemoveHandler(event, '/admin/attributes', 'attribute'))
