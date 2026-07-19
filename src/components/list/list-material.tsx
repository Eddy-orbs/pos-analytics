import React from 'react';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';

import './list.scss';

interface StateProps {
  titles: string[];
  titleClassName: string;
  children: any;
  listClassName?: string;
  listHeaderBg?: string;
  isLoading?: boolean;
  loadingRows?: number;
}

export const ListMaterial = (props: StateProps) => {
  const { titles, titleClassName, listClassName, listHeaderBg, isLoading, loadingRows = 5 } = props;
  const className = listClassName ? `list ${listClassName}` : 'list';
  return (
    <TableContainer
      component={Paper}
      className={className}
      style={{
        boxShadow: 'none',
      }}
      aria-busy={isLoading}
    >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {titles.map((title: string, index: number) => {
              return (
                <TableCell
                  key={index}
                  style={{
                    background: listHeaderBg || 'transparent',
                  }}
                >
                  <p className={`${titleClassName} one-line capitalize`}>
                    {title}
                  </p>
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <TableRow className="list-skeleton-row" key={`skeleton-${rowIndex}`}>
                  {titles.map((_, cellIndex) => (
                    <TableCell key={`skeleton-${rowIndex}-${cellIndex}`}>
                      <span className="list-skeleton-cell" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : props.children}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
