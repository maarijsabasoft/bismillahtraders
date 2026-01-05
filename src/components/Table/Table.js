import React from 'react';
import './Table.css';

const Table = ({ columns, data, onRowClick, actions }) => {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
            {actions && <th style={{ width: '100px' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="table-empty">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr 
                key={row.id || index} 
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? 'table-row-clickable' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="table-actions">
                      {actions(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;

