<style>
    @page { margin: 100px 80px; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: 'DejaVu Sans', Arial, sans-serif;
        font-size: 10px;
        color: #000;
        padding: 20px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    table + table {
        margin-top: 14px;
    }

    th, td {
        border: 1px solid #000;
        padding: 4px 7px;
        text-align: left;
        vertical-align: middle;
        height: 22px;
        line-height: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    th {
        background-color: #F48E00;
        color: #ffffff;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    td {
        font-size: 10px;
    }

    td.numeric, th.numeric {
        text-align: right;
    }

    td.center, th.center {
        text-align: center;
    }

    /* Section title (used in grouped reports) */
    .section-title {
        margin-top: 16px;
        margin-bottom: 6px;
        padding: 5px 8px;
        background-color: #F48E00;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        border: 1px solid #000;
    }

    .section-title:first-child,
    body > .section-title:first-of-type {
        margin-top: 0;
    }

    .total-row td {
        background-color: #f3f4f6;
        font-weight: 700;
    }
</style>
